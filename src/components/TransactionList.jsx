import { useEffect, useState } from 'react';
import { getTransactions, updateTransaction } from '../data/db';
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
    (async () => {
      try {
        const data = await getTransactions();
        if (!cancelled) {
          setTransactions(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch transactions');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
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

  if (loading) return <p>Loading transactions...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Transactions</h2>
      <div style={{ marginBottom: '1.5rem' }}>
        <strong>Total Income:</strong> <span className='trans-income'>{naira.format(totalIncome)}</span> &nbsp; | &nbsp;
        <strong>Total Expense:</strong> <span className='trans-expense'>{naira.format(totalExpense)}</span> &nbsp; | &nbsp;
        <strong>Net Balance:</strong> <span className={netBalance >= 0 ? 'trans-income' : 'trans-expense'}>{naira.format(netBalance)}</span>
      </div>
      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Description</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                return [
                  <tr key={monthKey} style={{ background: '#edf2f7' }}>
                    <td colSpan={6} style={{ fontWeight: 'bold' }}>
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
                        className={t.type === 'income' ? 'trans-income' : 'trans-expense'}
                      >
                        <td>
                          {isParentIncome && childAllocations.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => ({
                                  ...prev,
                                  [t.id]: !prev[t.id],
                                }))
                              }
                              style={{ padding: '0 0.4rem' }}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td>{formatDate(t.date)}</td>
                        <td>
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
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              textAlign: 'right',
                            }}
                          />
                        </td>
                        <td>{t.account_name || t.account_id}</td>
                        <td
                          style={{
                            verticalAlign: 'top',
                            cursor: editRows[t.id]?.isEditingDescription ? 'text' : 'pointer',
                          }}
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
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                display: 'block',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'break-word',
                              }}
                            >
                              {t.description ?? ''}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            verticalAlign: 'top',
                            cursor: editRows[t.id]?.isEditingNotes ? 'text' : 'pointer',
                          }}
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
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                display: 'block',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'break-word',
                              }}
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
                          <tr key={`${t.id}-${a.id}`} className="trans-income">
                            <td></td>
                            <td>{formatDate(a.date)}</td>
                            <td>
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
                                style={{
                                  width: '100%',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  textAlign: 'right',
                                }}
                              />
                            </td>
                            <td>{a.account_name || a.account_id}</td>
                            <td
                              style={{
                                verticalAlign: 'top',
                                cursor: editRows[a.id]?.isEditingDescription
                                  ? 'text'
                                  : 'pointer',
                              }}
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
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    display: 'block',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'break-word',
                                  }}
                                >
                                  {a.description ?? ''}
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                verticalAlign: 'top',
                                cursor: editRows[a.id]?.isEditingNotes
                                  ? 'text'
                                  : 'pointer',
                              }}
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
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    display: 'block',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'break-word',
                                  }}
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
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ marginRight: 8 }}
            >
              Previous
            </button>
            Page {page} of {totalPages}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ marginLeft: 8 }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TransactionList; 