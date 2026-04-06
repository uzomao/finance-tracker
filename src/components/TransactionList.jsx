import { useEffect, useState } from 'react';
import { updateTransaction } from '../data/db';
import { subscribeToTransactions } from '../data/transactionsRealtime';
import { formatDate } from './TransactionForm';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [expanded, setExpanded] = useState({});
  const [editRows, setEditRows] = useState({});

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    (async () => {
      try {
        unsubscribe = await subscribeToTransactions(
          (data) => {
            if (cancelled) return;
            setTransactions(data);
            setLoading(false);
          },
          () => {
            if (cancelled) return;
            setError('Failed to fetch transactions');
            setLoading(false);
          },
        );
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch transactions');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Currency formatter for Naira
  const naira = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  });

  const plainAmountFormatter = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && (t.account_id === null || t.account_id === undefined))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Group transactions by month (YYYY-MM)
  const groupByMonth = (txs) => {
    return txs.reduce((groups, tx) => {
      const date = tx.date ? new Date(tx.date) : null;
      if (!date) return groups;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
      return groups;
    }, {});
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Build allocation index and base (non-allocation) list
  const allocationsByParent = transactions.reduce((map, tx) => {
    if (tx.type === 'income' && tx.account_id != null && tx.parent_income_id != null) {
      if (!map[tx.parent_income_id]) map[tx.parent_income_id] = [];
      map[tx.parent_income_id].push(tx);
    }
    return map;
  }, {});

  // Base list excludes all allocation-style income rows (any income with an account)
  const baseTransactions = transactions.filter(
    (t) => !(t.type === 'income' && t.account_id != null)
  );

  // Pagination logic
  const totalPages = Math.ceil(baseTransactions.length / pageSize);
  const pagedTransactions = baseTransactions.slice((page - 1) * pageSize, page * pageSize);
  const grouped = groupByMonth(pagedTransactions);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // Descending

  const handleFieldChange = (tx, field, value) => {
    setEditRows((prev) => ({
      ...prev,
      [tx.id]: {
        amountText:
          field === 'amount'
            ? value
            : prev[tx.id]?.amountText ?? String(tx.amount ?? ''),
        description:
          field === 'description'
            ? value
            : prev[tx.id]?.description ?? (tx.description ?? ''),
        notes:
          field === 'notes'
            ? value
            : prev[tx.id]?.notes ?? (tx.notes ?? tx.source ?? ''),
        dirty: true,
      },
    }));
  };

  const handleBlurSave = async (tx) => {
    const current = editRows[tx.id];
    if (!current || !current.dirty) return;

    const updates = {};

    if (current.amountText != null) {
      const numericAmount = parseFloat(String(current.amountText).replace(/,/g, ''));
      if (!Number.isNaN(numericAmount) && numericAmount !== tx.amount) {
        updates.amount = numericAmount;
      }
    }

    if (current.description != null && current.description !== tx.description) {
      updates.description = current.description;
    }

    const currentNotes = current.notes ?? '';
    const originalNotes = tx.notes ?? tx.source ?? '';
    if (currentNotes !== originalNotes) {
      updates.notes = currentNotes;
    }

    if (Object.keys(updates).length === 0) {
      setEditRows((prev) => ({
        ...prev,
        [tx.id]: { ...prev[tx.id], dirty: false, amountText: undefined },
      }));
      return;
    }

    try {
      // If this is a parent income and the amount changed, recompute its allocation children
      const isParentIncome =
        tx.type === 'income' && (tx.account_id === null || tx.account_id === undefined);

      let childAmountUpdates = [];

      if (isParentIncome && typeof updates.amount === 'number') {
        const oldAmount = tx.amount;
        const newAmount = updates.amount;

        if (oldAmount && oldAmount !== 0) {
          const children = transactions.filter(
            (child) =>
              child.parent_income_id === tx.id &&
              child.type === 'income' &&
              child.account_id != null
          );

          childAmountUpdates = children.map((child) => {
            const ratio = child.amount / oldAmount;
            const newChildAmount = Number((newAmount * ratio).toFixed(2));
            return { id: child.id, amount: newChildAmount };
          });
        }
      }

      const updated = await updateTransaction(tx.id, updates);
      if (!updated) {
        setError('Failed to update transaction');
        return;
      }

      for (const childUpdate of childAmountUpdates) {
        await updateTransaction(childUpdate.id, { amount: childUpdate.amount });
      }

      setTransactions((prev) => {
        const childMap = new Map(
          childAmountUpdates.map((c) => [c.id, c.amount])
        );
        return prev.map((t) => {
          if (t.id === tx.id) {
            return { ...t, ...updates };
          }
          if (childMap.has(t.id)) {
            return { ...t, amount: childMap.get(t.id) };
          }
          return t;
        });
      });
      setEditRows((prev) => ({
        ...prev,
        [tx.id]: { ...prev[tx.id], dirty: false, amountText: undefined },
      }));
    } catch (e) {
      setError('Failed to update transaction');
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading transactions...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm text-slate-700">
          <span>
            <span className="font-semibold">Total Income:</span>{' '}
            <span className="trans-income">{naira.format(totalIncome)}</span>
          </span>
          <span>
            <span className="font-semibold">Total Expense:</span>{' '}
            <span className="trans-expense">{naira.format(totalExpense)}</span>
          </span>
          <span>
            <span className="font-semibold">Net Balance:</span>{' '}
            <span className={netBalance >= 0 ? 'trans-income' : 'trans-expense'}>
              {naira.format(netBalance)}
            </span>
          </span>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs md:text-sm">
                <thead className="bg-gray-50 text-[0.7rem] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2"></th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Account Debited</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
              {sortedMonths.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                return [
                  <tr key={monthKey} className="bg-gray-100">
                    <td
                      colSpan={6}
                      className="px-3 py-2 text-xs md:text-sm font-semibold text-slate-700"
                    >
                      {monthNames[parseInt(month, 10) - 1]} {year}
                    </td>
                  </tr>,
                  ...grouped[monthKey].flatMap((t) => {
                    const isParentIncome =
                      t.type === 'income' && (t.account_id === null || t.account_id === undefined);
                    const childAllocations = isParentIncome ? allocationsByParent[t.id] || [] : [];
                    const isExpanded = !!expanded[t.id];

                    const rows = [
                      <tr
                        key={t.id}
                        className={`border-t border-gray-100 text-xs md:text-sm ${
                          t.type === 'income' ? 'trans-income' : 'trans-expense'
                        }`}
                      >
                        <td className="px-4 py-4 align-top">
                          {isParentIncome && childAllocations.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => ({
                                  ...prev,
                                  [t.id]: !prev[t.id],
                                }))
                              }
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs leading-none hover:bg-gray-50"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td
                          className={`px-3 py-4 align-top ${
                            editRows[t.id]?.isEditingDescription ? 'cursor-text' : 'cursor-pointer'
                          }`}
                          onClick={() => {
                            if (editRows[t.id]?.isEditingDescription) return;
                            setEditRows((prev) => ({
                              ...prev,
                              [t.id]: {
                                ...(prev[t.id] || {}),
                                description:
                                  prev[t.id]?.description ?? (t.description ?? ''),
                                isEditingDescription: true,
                              },
                            }));
                          }}
                        >
                          {editRows[t.id]?.isEditingDescription ? (
                            <input
                              type="text"
                              autoFocus
                              value={editRows[t.id]?.description ?? (t.description ?? '')}
                              onChange={(e) =>
                                handleFieldChange(t, 'description', e.target.value)
                              }
                              onBlur={() => {
                                handleBlurSave(t);
                                setEditRows((prev) => ({
                                  ...prev,
                                  [t.id]: {
                                    ...(prev[t.id] || {}),
                                    isEditingDescription: false,
                                  },
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full bg-transparent text-xs md:text-sm text-slate-800 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="block whitespace-pre-wrap break-words text-xs md:text-sm text-slate-700"
                            >
                              {t.description ?? ''}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-left">
                          <input
                            type="text"
                            value={
                              editRows[t.id]?.amountText ??
                              (t.amount !== undefined && t.amount !== null
                                ? plainAmountFormatter.format(t.amount)
                                : '')
                            }
                            onChange={(e) => handleFieldChange(t, 'amount', e.target.value)}
                            onBlur={() => handleBlurSave(t)}
                            className={`w-full min-w-[100px] bg-transparent text-left text-xs md:text-sm focus:outline-none focus:ring-0 border-none ${
                              t.type === 'income' ? 'trans-income' : 'trans-expense'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-3 py-4 text-xs md:text-sm text-slate-700">
                          {t.account_name || t.account_id}
                        </td>
                        <td
                          className={`px-3 py-2 align-top ${
                            editRows[t.id]?.isEditingNotes ? 'cursor-text' : 'cursor-pointer'
                          }`}
                          onClick={() => {
                            if (editRows[t.id]?.isEditingNotes) return;
                            setEditRows((prev) => ({
                              ...prev,
                              [t.id]: {
                                ...(prev[t.id] || {}),
                                notes:
                                  prev[t.id]?.notes ?? (t.notes ?? t.source ?? ''),
                                isEditingNotes: true,
                              },
                            }));
                          }}
                        >
                          {editRows[t.id]?.isEditingNotes ? (
                            <input
                              type="text"
                              autoFocus
                              value={editRows[t.id]?.notes ?? (t.notes ?? t.source ?? '')}
                              onChange={(e) => handleFieldChange(t, 'notes', e.target.value)}
                              onBlur={() => {
                                handleBlurSave(t);
                                setEditRows((prev) => ({
                                  ...prev,
                                  [t.id]: {
                                    ...(prev[t.id] || {}),
                                    isEditingNotes: false,
                                  },
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full bg-transparent text-xs md:text-sm text-slate-800 focus:outline-none"
                            />
                          ) : (
                            <span
                              className="block whitespace-pre-wrap break-words text-xs md:text-sm text-slate-700"
                            >
                              {t.notes ?? t.source ?? ''}
                            </span>
                          )}
                        </td>
                      </tr>,
                    ];

                    if (isParentIncome && isExpanded && childAllocations.length > 0) {
                      childAllocations.forEach((a) => {
                        rows.push(
                          <tr
                            key={`${t.id}-${a.id}`}
                            className="border-t border-gray-100 text-[0.65rem] md:text-xs trans-income"
                          >
                            <td className="px-6 py-2" />
                            <td
                              className={`px-3 py-2 align-top ${
                                editRows[a.id]?.isEditingDescription
                                  ? 'cursor-text'
                                  : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (editRows[a.id]?.isEditingDescription) return;
                                setEditRows((prev) => ({
                                  ...prev,
                                  [a.id]: {
                                    ...(prev[a.id] || {}),
                                    description:
                                      prev[a.id]?.description ?? (a.description ?? ''),
                                    isEditingDescription: true,
                                  },
                                }));
                              }}
                            >
                              {editRows[a.id]?.isEditingDescription ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={
                                    editRows[a.id]?.description ?? (a.description ?? '')
                                  }
                                  onChange={(e) =>
                                    handleFieldChange(a, 'description', e.target.value)
                                  }
                                  onBlur={() => {
                                    handleBlurSave(a);
                                    setEditRows((prev) => ({
                                      ...prev,
                                      [a.id]: {
                                        ...(prev[a.id] || {}),
                                        isEditingDescription: false,
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-full bg-transparent text-xs md:text-sm text-slate-800 focus:outline-none"
                                />
                              ) : (
                                <span
                                  className="block whitespace-pre-wrap break-words text-xs md:text-sm text-slate-700"
                                >
                                  {a.description ?? ''}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-left">
                              <input
                                type="text"
                                value={
                                  editRows[a.id]?.amountText ??
                                  (a.amount !== undefined && a.amount !== null
                                    ? plainAmountFormatter.format(a.amount)
                                    : '')
                                }
                                onChange={(e) => handleFieldChange(a, 'amount', e.target.value)}
                                onBlur={() => handleBlurSave(a)}
                                className={`w-full min-w-[100px] bg-transparent text-left text-xs md:text-sm focus:outline-none focus:ring-0 border-none ${
                                  a.type === 'income' ? 'trans-income' : 'trans-expense'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                              {formatDate(a.date)}
                            </td>
                            <td className="px-3 py-2 text-xs md:text-sm text-slate-700">
                              {a.account_name || a.account_id}
                            </td>
                            <td
                              className={`px-3 py-2 align-top ${
                                editRows[a.id]?.isEditingNotes ? 'cursor-text' : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (editRows[a.id]?.isEditingNotes) return;
                                setEditRows((prev) => ({
                                  ...prev,
                                  [a.id]: {
                                    ...(prev[a.id] || {}),
                                    notes: prev[a.id]?.notes ?? (a.notes ?? ''),
                                    isEditingNotes: true,
                                  },
                                }));
                              }}
                            >
                              {editRows[a.id]?.isEditingNotes ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editRows[a.id]?.notes ?? (a.notes ?? '')}
                                  onChange={(e) =>
                                    handleFieldChange(a, 'notes', e.target.value)
                                  }
                                  onBlur={() => {
                                    handleBlurSave(a);
                                    setEditRows((prev) => ({
                                      ...prev,
                                      [a.id]: {
                                        ...(prev[a.id] || {}),
                                        isEditingNotes: false,
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-full bg-transparent text-xs md:text-sm text-slate-800 focus:outline-none"
                                />
                              ) : (
                                <span
                                  className="block whitespace-pre-wrap break-words text-xs md:text-sm text-slate-700"
                                >
                                  {a.notes ?? ''}
                                </span>
                              )}
                            </td>
                            <td>{a.type}</td>
                          </tr>
                        );
                      });
                    }

                    return rows;
                  })
                ];
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs md:text-sm text-slate-700">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs md:text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs md:text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </>
        )}
      </div>
    </div>
  );
}

export default TransactionList; 