/* ==========================================================================
   Recur: subscription management suite
   Sections: 1 Seed data · 2 Helpers · 3 Shell · 4 Customer portal
             5 Finance dashboard · 6 QA · 7 Seed data view · 8 Demo script
   ========================================================================== */

/* ---------- 1. Seed data (deterministic) ---------- */

const PLANS = [
  { id: 'starter', name: 'Starter', price: 19, seats: 3 },
  { id: 'growth', name: 'Growth', price: 79, seats: 15 },
  { id: 'scale', name: 'Scale', price: 249, seats: 60 },
];

const NOW = new Date(2026, 9, 31);

// Last 12 months, oldest first, ending October 2026.
const MONTHS = [];
for (let i = 11; i >= 0; i--) {
  const d = new Date(2026, 9 - i, 1);
  MONTHS.push(d.toLocaleString('en', { month: 'short', year: '2-digit' }));
}

// Small seeded random number generator so every reload gives the same data.
function rng(seedValue) {
  let a = seedValue;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed() {
  const r = rng(26);
  const firstNames = [
    'Northwind', 'Bluefin', 'Kestrel', 'Lumen', 'Orchard', 'Pinecone',
    'Quill', 'Ridgeway', 'Saffron', 'Tidewater', 'Umbra', 'Vantage',
  ];
  const suffixes = ['Labs', 'Studio', 'Co'];
  const customers = [];
  let count = 0;

  for (const suffix of suffixes) {
    for (const first of firstNames) {
      count++;

      const planRoll = r();
      const plan = planRoll < 0.5 ? 'starter' : planRoll < 0.85 ? 'growth' : 'scale';
      const start = Math.floor(r() * 11);
      let status = 'active';
      let cancel = null;

      const statusRoll = r();
      if (statusRoll < 0.15) {
        status = 'canceled';
        cancel = start + 1 + Math.floor(r() * (11 - start));
      } else if (statusRoll < 0.23) {
        status = 'past_due';
      }

      customers.push({
        id: 'c' + String(count).padStart(2, '0'),
        name: first + ' ' + suffix,
        email: 'billing@' + first.toLowerCase() + '-' + suffix.toLowerCase() + '.example',
        plan,
        start,
        status,
        cancel,
        cancelAtEnd: false,
        card: status === 'past_due' ? 'expired' : 'ok',
        last4: String(1000 + Math.floor(r() * 8999)),
        renewDay: 1 + Math.floor(r() * 28),
      });
    }
  }

  // Fixed demo personas used by the demo script.
  Object.assign(customers[0], {
    name: 'Northwind Labs', plan: 'starter', status: 'active',
    cancel: null, start: 2, card: 'ok', last4: '4242', renewDay: 14,
  });
  Object.assign(customers[1], {
    name: 'Bluefin Studio', plan: 'growth', status: 'past_due',
    cancel: null, start: 4, card: 'expired', last4: '0341', renewDay: 3,
  });
  Object.assign(customers[2], {
    name: 'Kestrel Co', plan: 'scale', status: 'active',
    cancel: null, start: 1, card: 'ok', last4: '1881', renewDay: 21,
  });

  return {
    plans: PLANS,
    customers,
    events: [{ t: 'Seed data loaded', c: 'system' }],
  };
}

let S = seed();

/* ---------- 2. Helpers ---------- */

const money = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);

const money2 = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const price = (planId) => PLANS.find((p) => p.id === planId).price;
const live = (c) => c.status !== 'canceled';

// Customers subscribed during month index m.
const subsAt = (m) =>
  S.customers.filter((c) => c.start <= m && (c.cancel == null || c.cancel > m));

const mrrAt = (m) => subsAt(m).reduce((sum, c) => sum + price(c.plan), 0);
const mrr = () => S.customers.filter(live).reduce((sum, c) => sum + price(c.plan), 0);

function invoices(c) {
  const out = [];
  const end = c.cancel == null ? 11 : c.cancel - 1;

  for (let m = c.start; m <= end; m++) {
    const failed = c.status === 'past_due' && m === 11 && c.card === 'expired';
    out.push({
      no: 'INV-' + c.id.slice(1) + '-' + String(m + 1).padStart(2, '0'),
      month: MONTHS[m],
      amount: price(c.plan),
      status: failed ? 'failed' : 'paid',
    });
  }
  return out.reverse();
}

// Charge (positive) or credit (negative) for switching plans mid-cycle.
const prorate = (from, to, daysLeft) =>
  Math.round(((to - from) * daysLeft) / 30 * 100) / 100;

function daysLeft(c) {
  let d = c.renewDay - NOW.getDate();
  if (d <= 0) d += 30;
  return d;
}

function log(text, customerId) {
  S.events.unshift({ t: text, c: customerId });
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- 3. Shell (tabs, routing, reset) ---------- */

const TABS = [
  ['portal', 'Customer portal'],
  ['finance', 'Finance dashboard'],
  ['qa', 'QA'],
  ['seed', 'Seed data'],
  ['demo', 'Demo script'],
];

let tab = 'portal';
let cust = 'c01';
let qaManual = {};

const tabsEl = document.getElementById('tabs');
const V = document.getElementById('view');

function drawTabs() {
  tabsEl.innerHTML = TABS.map(
    ([key, label]) =>
      `<button role="tab" aria-selected="${key === tab}" data-t="${key}">${label}</button>`
  ).join('');
}

function render() {
  const views = { portal, finance, qa, seed: seedView, demo };
  views[tab]();
}

function go(next) {
  tab = next;
  try {
    history.replaceState(null, '', '#' + next);
  } catch (e) {
    /* ignore: history may be unavailable in sandboxed frames */
  }
  drawTabs();
  render();
  window.scrollTo(0, 0);
}

tabsEl.onclick = (e) => {
  const target = e.target.dataset.t;
  if (target) go(target);
};

document.getElementById('reset').onclick = () => {
  S = seed();
  qaManual = {};
  render();
  toast('Demo data reset');
};

/* ---------- 4. Customer portal ---------- */

function portal() {
  const c = S.customers.find((x) => x.id === cust);
  const p = PLANS.find((x) => x.id === c.plan);
  const inv = invoices(c);
  const status = c.cancelAtEnd ? 'canceling' : c.status;

  const customerOptions = S.customers
    .map(
      (x) => `
        <option value="${x.id}" ${x.id === cust ? 'selected' : ''}>
          ${x.name}${x.id < 'c04' ? ' (demo)' : ''}
        </option>`
    )
    .join('');

  const planCards = PLANS.map((x) => {
    const isCurrent = x.id === c.plan && c.status !== 'canceled';
    const action = isCurrent
      ? '<span class="pill s-trialing">Current</span>'
      : `<button class="btn alt" data-plan="${x.id}">
           ${c.status === 'canceled' ? 'Restart on' : 'Switch to'} ${x.name}
         </button>`;

    return `
      <div class="plan ${isCurrent ? 'cur' : ''}">
        <div>${x.name}</div>
        <b>${money(x.price)}</b><span class="sub"> /mo</span>
        <p class="sub" style="margin:4px 0 8px">${x.seats} seats</p>
        ${action}
      </div>`;
  }).join('');

  const invoiceRows =
    inv
      .map(
        (i) => `
          <tr>
            <td class="mono">${i.no}</td>
            <td>${i.month}</td>
            <td class="n">${money2(i.amount)}</td>
            <td><span class="pill ${i.status === 'paid' ? 's-active' : 's-past_due'}">${i.status}</span></td>
          </tr>`
      )
      .join('') || '<tr><td colspan="4">No invoices yet.</td></tr>';

  const cancelCard =
    c.status !== 'canceled' && !c.cancelAtEnd
      ? `
        <div class="card" style="margin-top:14px">
          <h2>Cancel subscription</h2>
          <p class="sub">You keep access until the end of this billing period.</p>
          <div class="row">
            <select id="why" aria-label="Reason for canceling">
              <option>Too expensive</option>
              <option>Missing a feature</option>
              <option>Switching tools</option>
              <option>No longer needed</option>
            </select>
            <button class="btn danger" id="cancel">Cancel at period end</button>
          </div>
        </div>`
      : '';

  V.innerHTML = `
    <h1>Your subscription</h1>
    <p class="sub">
      Signed in as a demo customer. Changes here appear in the finance dashboard straight away.
    </p>

    <div class="row" style="margin-bottom:14px">
      <label for="who">Viewing as</label>
      <select id="who">${customerOptions}</select>
    </div>

    ${c.status === 'past_due' ? `
      <div class="note alert">
        <b>Your last payment failed.</b>
        The card ending ${c.last4} has expired. Update your card to keep your plan active.
      </div>` : ''}
    ${c.cancelAtEnd ? `
      <div class="note">
        Your plan ends on ${NOW.toLocaleString('en', { month: 'long' })} ${c.renewDay}.
        You keep full access until then.
      </div>` : ''}
    ${c.status === 'canceled' ? `
      <div class="note alert">
        This subscription is canceled. Choose a plan below to restart it.
      </div>` : ''}

    <div class="grid g2">
      <div class="card">
        <h2>Current plan</h2>
        <div class="row">
          <b style="font-size:22px">${p.name}</b>
          <span class="pill s-${status}">${status.replace('_', ' ')}</span>
        </div>
        <p style="margin:6px 0 0">${money(p.price)} per month · up to ${p.seats} seats</p>
        <p class="sub" style="margin:4px 0 0">
          ${c.status === 'canceled' ? 'Ended ' + MONTHS[c.cancel] : 'Renews in ' + daysLeft(c) + ' days'}
        </p>
      </div>

      <div class="card">
        <h2>Payment method</h2>
        <p style="margin:0 0 10px">
          Card ending <span class="mono">${c.last4}</span> ·
          ${c.card === 'expired' ? '<span class="down">expired</span>' : 'valid'}
        </p>
        <div class="row">
          <input id="newcard" inputmode="numeric" maxlength="4"
                 placeholder="New card, last 4 digits" aria-label="New card last 4 digits">
          <button class="btn" id="upcard">Update card</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Change plan</h2>
      <div class="plans">${planCards}</div>
      <div id="prev"></div>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Invoices</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr><th>Invoice</th><th>Period</th><th class="n">Amount</th><th>Status</th></tr>
          </thead>
          <tbody>${invoiceRows}</tbody>
        </table>
      </div>
    </div>

    ${cancelCard}`;

  bindPortalEvents(c);
}

function bindPortalEvents(c) {
  document.getElementById('who').onchange = (e) => {
    cust = e.target.value;
    portal();
  };

  document.getElementById('upcard').onclick = () => {
    const value = document.getElementById('newcard').value.trim();
    if (!/^\d{4}$/.test(value)) {
      return toast('Enter exactly 4 digits for the new card');
    }

    c.last4 = value;
    c.card = 'ok';

    if (c.status === 'past_due') {
      c.status = 'active';
      log(c.name + ' updated card and recovered a failed payment', c.id);
    } else {
      log(c.name + ' updated payment card', c.id);
    }
    toast('Card updated');
    portal();
  };

  V.querySelectorAll('[data-plan]').forEach((button) => {
    button.onclick = () => previewPlanChange(c, button.dataset.plan);
  });

  const cancelButton = document.getElementById('cancel');
  if (cancelButton) {
    cancelButton.onclick = () => {
      c.cancelAtEnd = true;
      log(c.name + ' scheduled cancellation: ' + document.getElementById('why').value, c.id);
      toast('Cancellation scheduled');
      portal();
    };
  }
}

function previewPlanChange(c, to) {
  // Restarting a canceled subscription needs no proration.
  if (c.status === 'canceled') {
    c.status = 'active';
    c.cancel = null;
    c.plan = to;
    log(c.name + ' restarted on ' + to, c.id);
    toast('Subscription restarted');
    return portal();
  }

  const d = daysLeft(c);
  const amount = prorate(price(c.plan), price(to), d);
  const fromName = PLANS.find((x) => x.id === c.plan).name;
  const toName = PLANS.find((x) => x.id === to).name;
  const message =
    amount >= 0
      ? `You will be charged ${money2(amount)} today for the remaining ${d} days.`
      : `You will receive a ${money2(-amount)} credit on your next invoice.`;

  document.getElementById('prev').innerHTML = `
    <div class="note">
      <b>${fromName} to ${toName}.</b> ${message}
      <div class="row" style="margin-top:8px">
        <button class="btn" id="ok">Confirm change</button>
        <button class="btn alt" id="no">Keep current plan</button>
      </div>
    </div>`;

  document.getElementById('no').onclick = () => portal();
  document.getElementById('ok').onclick = () => {
    const verb = amount >= 0 ? 'upgraded' : 'downgraded';
    log(`${c.name} ${verb} ${c.plan} to ${to} (${money2(amount)} proration)`, c.id);
    c.plan = to;
    toast('Plan changed to ' + toName);
    portal();
  };
}

/* ---------- 5. Finance dashboard ---------- */

function mrrChart(series) {
  const W = 640;
  const H = 200;
  const max = Math.max(...series) * 1.1;

  const bars = series
    .map((value, i) => {
      const h = (value / max) * H;
      const x = 14 + i * 52;
      const fill = i === 11 ? 'var(--bar)' : 'var(--bar2)';
      return `
        <rect x="${x}" y="${H - h + 10}" width="34" height="${h}" rx="3" fill="${fill}"/>
        <text x="${x + 17}" y="${H - h + 4}" text-anchor="middle" font-size="10" fill="var(--mute)">${Math.round(value)}</text>
        <text x="${x + 17}" y="${H + 26}" text-anchor="middle" font-size="10" fill="var(--mute)">${MONTHS[i].split(' ')[0]}</text>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${W} ${H + 34}" width="100%" role="img"
         aria-label="Monthly recurring revenue by month" style="min-width:520px">${bars}</svg>`;
}

function finance() {
  const current = mrr();
  const previous = mrrAt(10);
  const active = S.customers.filter(live);
  const canceledNow = S.customers.filter((c) => c.cancel === 11).length;
  const startOfMonth = subsAt(10).length;
  const churn = startOfMonth ? (canceledNow / startOfMonth) * 100 : 0;

  const atRisk = S.customers
    .filter((c) => c.cancelAtEnd)
    .reduce((sum, c) => sum + price(c.plan), 0);
  const pastDue = S.customers.filter((c) => c.status === 'past_due');
  const pastDueAmount = pastDue.reduce((sum, c) => sum + price(c.plan), 0);

  const series = MONTHS.map((_, i) => (i === 11 ? current : mrrAt(i)));

  const mix = PLANS.map((p) => {
    const count = active.filter((c) => c.plan === p.id).length;
    return { plan: p, count, value: count * p.price };
  });

  const mixRows = mix
    .map(
      (x) => `
        <div style="margin:10px 0">
          <div class="row">
            <span>${x.plan.name}</span><span class="sp"></span>
            <span class="num">${money(x.value)} · ${x.count} accounts</span>
          </div>
          <div style="background:var(--bg);border-radius:4px;height:10px">
            <div style="width:${current ? (x.value / current) * 100 : 0}%;height:10px;border-radius:4px;background:var(--bar)"></div>
          </div>
        </div>`
    )
    .join('');

  const failedPayments = pastDue.length
    ? `<table><tbody>${pastDue
        .map(
          (c) => `
            <tr>
              <td>${c.name}<div class="sub mono" style="margin:0">${c.id}</div></td>
              <td class="n">${money(price(c.plan))}</td>
              <td class="n"><button class="btn alt" data-retry="${c.id}">Retry charge</button></td>
            </tr>`
        )
        .join('')}</tbody></table>`
    : '<p class="sub">No failed payments. Nice.</p>';

  const feed = S.events
    .slice(0, 30)
    .map((e) => `<li>${e.t}</li>`)
    .join('');

  V.innerHTML = `
    <h1>Finance dashboard</h1>
    <p class="sub">
      Revenue, churn and failed payments for the last 12 months, calculated from the same
      data the customer portal edits.
    </p>

    <div class="grid g4">
      <div class="card kpi">
        <span>Monthly recurring revenue</span>
        <b class="num">${money(current)}</b>
        <em class="${current >= previous ? 'up' : 'down'}">
          ${current >= previous ? '+' : ''}${money(current - previous)} vs last month
        </em>
      </div>
      <div class="card kpi">
        <span>Annual run rate</span>
        <b class="num">${money(current * 12)}</b>
        <em>${active.length} live subscriptions</em>
      </div>
      <div class="card kpi">
        <span>Monthly logo churn</span>
        <b class="num">${churn.toFixed(1)}%</b>
        <em>${canceledNow} canceled of ${startOfMonth}</em>
      </div>
      <div class="card kpi">
        <span>Average revenue per account</span>
        <b class="num">${money2(current / active.length)}</b>
        <em class="${atRisk ? 'down' : ''}">${money(atRisk)} scheduled to cancel</em>
      </div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card">
        <h2>MRR by month</h2>
        <div class="scroll">${mrrChart(series)}</div>
      </div>
      <div class="card">
        <h2>Revenue by plan</h2>
        ${mixRows}
      </div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card">
        <h2>Failed payments · ${money(pastDueAmount)} at risk</h2>
        ${failedPayments}
      </div>
      <div class="card">
        <h2>Activity</h2>
        <ul class="feed">${feed}</ul>
      </div>
    </div>`;

  V.querySelectorAll('[data-retry]').forEach((button) => {
    button.onclick = () => retryCharge(button.dataset.retry);
  });
}

function retryCharge(customerId) {
  const c = S.customers.find((x) => x.id === customerId);

  if (c.card === 'expired') {
    log(`Retry failed for ${c.name}: card expired. Update link sent`, c.id);
    toast('Retry failed: card expired. Update link sent to customer');
  } else {
    c.status = 'active';
    log('Retry succeeded for ' + c.name, c.id);
    toast('Payment collected');
  }
  finance();
}

/* ---------- 6. QA ---------- */

const MANUAL = [
  ['Portal', 'Switch from Starter to Growth shows a charge preview before confirming'],
  ['Portal', 'Downgrade shows a credit, not a charge'],
  ['Portal', 'Card update rejects anything that is not 4 digits'],
  ['Portal', 'Past-due customer sees a failure banner and recovers after updating card'],
  ['Portal', 'Cancel keeps access and shows the end date'],
  ['Portal', 'Canceled customer can restart on any plan'],
  ['Finance', 'MRR changes immediately after a plan change in the portal'],
  ['Finance', 'Retry on an expired card fails with a clear message'],
  ['Finance', 'Scheduled cancellations show as at-risk revenue'],
  ['Finance', 'Chart labels and KPIs match the seed data'],
  ['General', 'Keyboard: every control reachable, focus ring visible'],
  ['General', 'Layout works at 375px wide with no sideways page scroll'],
  ['General', 'Dark mode text meets contrast'],
  ['General', 'Reset demo data restores the original state'],
];

function runAutomatedChecks() {
  const results = [];

  // Each check returns true on success, or a message describing the mismatch.
  const check = (name, fn) => {
    let ok = false;
    let msg = '';
    try {
      const outcome = fn();
      ok = outcome === true;
      msg = ok ? '' : String(outcome);
    } catch (e) {
      msg = e.message;
    }
    results.push({ n: name, ok, msg });
  };

  check('MRR equals sum of live plan prices', () =>
    mrr() === S.customers.filter(live).reduce((s, c) => s + PLANS.find((p) => p.id === c.plan).price, 0) ||
    'mismatch');

  check('Every customer references a valid plan', () =>
    S.customers.every((c) => PLANS.some((p) => p.id === c.plan)) || 'bad plan id');

  check('No invoice has a zero or negative amount', () =>
    S.customers.every((c) => invoices(c).every((i) => i.amount > 0)) || 'bad amount');

  check('Past-due customers have exactly one failed invoice', () =>
    S.customers
      .filter((c) => c.status === 'past_due')
      .every((c) => invoices(c).filter((i) => i.status === 'failed').length === 1) || 'count off');

  check('Canceled customers have a cancel month', () =>
    S.customers.filter((c) => c.status === 'canceled').every((c) => c.cancel != null) || 'missing');

  check('Upgrade Starter to Growth with 15 days left charges $30', () =>
    prorate(19, 79, 15) === 30 || prorate(19, 79, 15));

  check('Downgrade Scale to Starter with 15 days left credits $115', () =>
    prorate(249, 19, 15) === -115 || prorate(249, 19, 15));

  check('Upgrade then downgrade the same day nets to zero', () =>
    Math.abs(prorate(19, 79, 12) + prorate(79, 19, 12)) < 0.01 || 'drift');

  check('Last chart month equals headline MRR', () =>
    mrrAt(11) === mrr() || `chart ${mrrAt(11)} vs kpi ${mrr()}`);

  check('Seed has demo personas c01 (active), c02 (past due), c03 (active)', () =>
    ['active', 'past_due', 'active'].every((s, i) => S.customers[i].status === s) ||
    'persona changed');

  return results;
}

function qa() {
  const results = runAutomatedChecks();
  const passed = results.filter((x) => x.ok).length;
  const manualPassed = Object.values(qaManual).filter((v) => v === 'pass').length;
  const manualFailed = Object.values(qaManual).filter((v) => v === 'fail').length;

  const autoRows = results
    .map(
      (x) => `
        <tr>
          <td class="${x.ok ? 't-pass' : 't-fail'}" style="width:60px">${x.ok ? 'Pass' : 'Fail'}</td>
          <td>${x.n}${x.msg ? `<div class="sub" style="margin:0">${x.msg}</div>` : ''}</td>
        </tr>`
    )
    .join('');

  const manualRows = MANUAL.map(([area, text], i) => {
    const state = qaManual[i] || 'open';
    return `
      <tr>
        <td style="width:80px">${area}</td>
        <td>${text}</td>
        <td class="n" style="width:90px">
          <button class="btn alt t-${state}" data-m="${i}">${state}</button>
        </td>
      </tr>`;
  }).join('');

  V.innerHTML = `
    <h1>QA</h1>
    <p class="sub">
      Automated checks run against the live state, so they also catch regressions after you
      click around. Manual cases cycle open, pass, fail.
    </p>

    <div class="grid g4">
      <div class="card kpi">
        <span>Automated</span>
        <b class="${passed === results.length ? 'up' : 'down'}">${passed}/${results.length}</b>
        <em>passing now</em>
      </div>
      <div class="card kpi">
        <span>Manual passed</span><b class="up">${manualPassed}</b><em>of ${MANUAL.length}</em>
      </div>
      <div class="card kpi">
        <span>Manual failed</span>
        <b class="${manualFailed ? 'down' : ''}">${manualFailed}</b>
        <em>${MANUAL.length - manualPassed - manualFailed} still open</em>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="row">
        <h2 style="margin:0">Automated checks</h2><span class="sp"></span>
        <button class="btn" id="rerun">Run again</button>
      </div>
      <table><tbody>${autoRows}</tbody></table>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Manual test cases</h2>
      <table><tbody>${manualRows}</tbody></table>
    </div>`;

  document.getElementById('rerun').onclick = () => {
    qa();
    toast('Checks re-run');
  };

  V.querySelectorAll('[data-m]').forEach((button) => {
    button.onclick = () => {
      const order = ['open', 'pass', 'fail'];
      const i = button.dataset.m;
      qaManual[i] = order[(order.indexOf(qaManual[i] || 'open') + 1) % 3];
      qa();
    };
  });
}

/* ---------- 7. Seed data view ---------- */

function seedView() {
  const json = JSON.stringify({ plans: PLANS, customers: S.customers }, null, 2);
  const pastDue = S.customers.filter((c) => c.status === 'past_due').length;
  const canceled = S.customers.filter((c) => c.status === 'canceled').length;

  const rows = S.customers
    .map(
      (c) => `
        <tr>
          <td class="mono">${c.id}</td>
          <td>${c.name}</td>
          <td>${c.plan}</td>
          <td><span class="pill s-${c.status}">${c.status.replace('_', ' ')}</span></td>
          <td>${c.card}</td>
          <td class="n">${MONTHS[c.start]}</td>
        </tr>`
    )
    .join('');

  V.innerHTML = `
    <h1>Seed data</h1>
    <p class="sub">
      ${S.customers.length} customers across ${PLANS.length} plans, generated from a fixed random
      seed so every reload gives the same numbers. The first three are demo personas.
    </p>

    <div class="row" style="margin-bottom:12px">
      <button class="btn" id="cp">Copy JSON</button>
      <span class="sub" style="margin:0">
        Current MRR ${money(mrr())} · ${pastDue} past due · ${canceled} canceled
      </span>
    </div>

    <div class="card scroll">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Customer</th><th>Plan</th><th>Status</th><th>Card</th>
            <th class="n">Started</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>Raw JSON</h2>
      <pre class="mono" id="raw"></pre>
    </div>`;

  const raw = document.getElementById('raw');
  raw.textContent = json;

  document.getElementById('cp').onclick = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast('JSON copied');
    } catch (e) {
      // Clipboard blocked: select the text so the person can copy it by hand.
      const range = document.createRange();
      range.selectNodeContents(raw);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      toast('Select and copy the JSON below');
    }
  };
}

/* ---------- 8. Demo script ---------- */

const DEMO = [
  ['0:00', 'finance', 'Open the finance dashboard',
    'Set the scene: MRR, annual run rate and churn at a glance. Point out the failed payments card and the at-risk revenue.'],
  ['1:00', 'portal', 'Be a customer: Northwind Labs (c01)',
    'Show plan, invoices and next renewal. Say: “This is everything a customer needs without opening a support ticket.”'],
  ['2:00', 'portal', 'Upgrade Starter to Growth',
    'Click Switch to Growth. Read the proration preview aloud ($30 today at 15 days left in the cycle, varies with the date). Confirm.'],
  ['3:30', 'finance', 'Show the revenue moving',
    'Back on finance: MRR is up $60 and the activity feed shows the upgrade. Same data, no sync delay.'],
  ['4:30', 'finance', 'Failed payment: Bluefin Studio (c02)',
    'Click Retry charge. It fails because the card is expired, and an update link goes to the customer.'],
  ['5:30', 'portal', 'Customer fixes it themselves',
    'Switch to Bluefin Studio, read the red banner, enter 4 digits and Update card. Status flips to active.'],
  ['6:30', 'finance', 'Close the loop',
    'The failed payment is gone and the recovered revenue is back in MRR. Then cancel Kestrel Co at period end to show at-risk revenue.'],
  ['7:30', 'qa', 'Finish on quality',
    'Run the automated checks (all green), then open the manual cases. Offer to walk through any of them.'],
];

function demo() {
  const steps = DEMO.map(([time, target, title, body]) => {
    const label = TABS.find((t) => t[0] === target)[1].toLowerCase();
    return `
      <div class="step">
        <div class="tm mono">${time}</div>
        <div>
          <b>${title}</b>
          <p style="margin:2px 0 8px;max-width:70ch">${body}</p>
          <button class="btn alt" data-g="${target}">Open ${label}</button>
        </div>
      </div>`;
  }).join('');

  V.innerHTML = `
    <h1>Demo script</h1>
    <p class="sub">
      An 8-minute walkthrough that follows one story: grow revenue, lose some, win it back.
      Use Reset demo data before each run.
    </p>
    <div class="card">${steps}</div>
    <div class="card" style="margin-top:14px">
      <h2>If something goes wrong</h2>
      <p style="margin:0;max-width:70ch">
        Click Reset demo data at the top right. It restores all three personas and the numbers above in one click.
      </p>
    </div>`;

  V.querySelectorAll('[data-g]').forEach((button) => {
    button.onclick = () => go(button.dataset.g);
  });
}

/* ---------- Start ---------- */

const initial = (location.hash || '').slice(1);
if (TABS.some((t) => t[0] === initial)) tab = initial;

drawTabs();
render();

window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (TABS.some((t) => t[0] === next) && next !== tab) go(next);
});
