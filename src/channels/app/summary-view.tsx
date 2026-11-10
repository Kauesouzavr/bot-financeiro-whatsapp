import Link from "next/link";
import {
  formatMonthParam,
  hasNextMonth,
  hasPreviousMonth,
  nextMonth,
  previousMonth,
  type MonthRef,
} from "@/core/date/month";
import { formatCurrency } from "@/core/replies/format-reply";
import { formatDayLabel, formatMonthTitle, formatPercent } from "@/core/summary/format-summary";
import type { CategoryTotal, MonthSummary } from "@/core/summary/summarize-month";
import styles from "./summary.module.css";

interface SummaryViewProps {
  month: MonthRef;
  current: MonthRef;
  now: Date;
  summary: MonthSummary;
}

function monthHref(month: MonthRef): string {
  return `/app/resumo?mes=${formatMonthParam(month)}`;
}

interface CategoryListProps {
  title: string;
  items: CategoryTotal[];
  tone: "expense" | "income";
}

// Lista de categorias com uma barra proporcional ao percentual. A barra é só enfeite (aria-hidden):
// o valor e a porcentagem em texto já dizem tudo pra quem usa leitor de tela.
function CategoryList({ title, items, tone }: CategoryListProps) {
  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <ul className={styles.categories}>
        {items.map((item) => (
          <li key={item.category} className={styles.category}>
            <div className={styles.categoryRow}>
              <span className={styles.categoryName}>{item.category}</span>
              <span className={styles.categoryValue}>
                {formatCurrency(item.totalCents)}
                <span className={styles.percent}>{formatPercent(item.percent)}</span>
              </span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div
                className={`${styles.bar} ${tone === "income" ? styles.barIncome : styles.barExpense}`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Tela de resumo do mês: só leitura. Corrigir ou apagar um lançamento continua sendo pelo chat.
export function SummaryView({ month, current, now, summary }: SummaryViewProps) {
  const { balance } = summary;
  const isEmpty = summary.days.length === 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/app" className={styles.back}>
          ← Chat
        </Link>
        <h1 className={styles.title}>Resumo</h1>
      </header>

      <nav className={styles.monthNav} aria-label="Escolher mês">
        {hasPreviousMonth(month) ? (
          <Link
            href={monthHref(previousMonth(month))}
            className={styles.arrow}
            aria-label="Mês anterior"
          >
            ‹
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.arrowOff}`} aria-hidden="true">
            ‹
          </span>
        )}
        <p className={styles.month}>{formatMonthTitle(month)}</p>
        {hasNextMonth(month, current) ? (
          <Link
            href={monthHref(nextMonth(month))}
            className={styles.arrow}
            aria-label="Próximo mês"
          >
            ›
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.arrowOff}`} aria-hidden="true">
            ›
          </span>
        )}
      </nav>

      <main className={styles.content}>
        <section className={styles.totals} aria-label="Totais do mês">
          <div className={styles.total}>
            <span className={styles.totalLabel}>Entrou</span>
            <strong className={`${styles.totalValue} ${styles.income}`}>
              {formatCurrency(balance.incomeCents)}
            </strong>
          </div>
          <div className={styles.total}>
            <span className={styles.totalLabel}>Saiu</span>
            <strong className={`${styles.totalValue} ${styles.expense}`}>
              {formatCurrency(balance.expenseCents)}
            </strong>
          </div>
          <div className={styles.total}>
            <span className={styles.totalLabel}>Saldo</span>
            <strong className={styles.totalValue}>{formatCurrency(balance.balanceCents)}</strong>
          </div>
        </section>

        {isEmpty ? (
          <p className={styles.empty}>
            Nada registrado neste mês.
            <br />
            Volte ao chat e mande algo como &quot;gastei 45 no ifood&quot;.
          </p>
        ) : (
          <>
            <CategoryList
              title="Para onde foi o dinheiro"
              items={summary.expensesByCategory}
              tone="expense"
            />
            <CategoryList title="De onde veio" items={summary.incomesByCategory} tone="income" />

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Extrato</h2>
              {summary.days.map((day) => (
                <div key={day.date} className={styles.day}>
                  <h3 className={styles.dayTitle}>
                    <time dateTime={day.date}>{formatDayLabel(day.date, now)}</time>
                  </h3>
                  <ul className={styles.transactions}>
                    {day.transactions.map((transaction) => {
                      const isIncome = transaction.type === "income";
                      return (
                        <li key={transaction.id} className={styles.transaction}>
                          <div className={styles.transactionText}>
                            <span className={styles.transactionName}>
                              {transaction.description ?? transaction.category}
                            </span>
                            {transaction.description && (
                              <span className={styles.transactionCategory}>
                                {transaction.category}
                              </span>
                            )}
                          </div>
                          <span className={isIncome ? styles.income : styles.expense}>
                            {isIncome ? "+" : "−"} {formatCurrency(transaction.amountCents)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
