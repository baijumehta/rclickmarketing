import { firstDueOnOrAfter, nextDueAfter, describeCadence } from "../src/lib/recurrence";
import { parseDurationInput, formatDuration, relativeDay, addMonths, businessToday } from "../src/lib/dates";

let pass = 0;
let fail = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got ${a}\n         want ${e}`); }
}
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

console.log("\nWEEKLY on Monday (anchorDay 1)");
{
  const t = { cadence: "WEEKLY" as const, interval: 1, anchorDay: 1 };
  // 2026-09-20 is a Sunday.
  eq("first due from Sun 20 Sep -> Mon 21 Sep", iso(firstDueOnOrAfter(t, d("2026-09-20"))), "2026-09-21");
  eq("first due from Mon 21 Sep -> same day", iso(firstDueOnOrAfter(t, d("2026-09-21"))), "2026-09-21");
  eq("first due from Tue 22 Sep -> next Mon", iso(firstDueOnOrAfter(t, d("2026-09-22"))), "2026-09-28");
  eq("next after Mon 21 Sep", iso(nextDueAfter(t, d("2026-09-21"))), "2026-09-28");
}

console.log("\nBIWEEKLY on Tuesday");
{
  const t = { cadence: "BIWEEKLY" as const, interval: 1, anchorDay: 2 };
  eq("first due from Sun 20 Sep -> Tue 22 Sep", iso(firstDueOnOrAfter(t, d("2026-09-20"))), "2026-09-22");
  eq("next is 14 days later", iso(nextDueAfter(t, d("2026-09-22"))), "2026-10-06");
}

console.log("\nMONTHLY on the 1st");
{
  const t = { cadence: "MONTHLY" as const, interval: 1, anchorDay: 1 };
  eq("from 20 Sep -> 1 Oct", iso(firstDueOnOrAfter(t, d("2026-09-20"))), "2026-10-01");
  eq("from 1 Sep -> 1 Sep", iso(firstDueOnOrAfter(t, d("2026-09-01"))), "2026-09-01");
  eq("next after 1 Oct", iso(nextDueAfter(t, d("2026-10-01"))), "2026-11-01");
  eq("Dec rolls to Jan", iso(nextDueAfter(t, d("2026-12-01"))), "2027-01-01");
}

console.log("\nMONTHLY on the 31st means last day of month");
{
  const t = { cadence: "MONTHLY" as const, interval: 1, anchorDay: 31 };
  eq("Jan 31 -> Feb 28 (2027 not a leap year)", iso(nextDueAfter(t, d("2027-01-31"))), "2027-02-28");
  eq("Feb 28 -> Mar 31", iso(nextDueAfter(t, d("2027-02-28"))), "2027-03-31");
  eq("Apr has 30", iso(nextDueAfter(t, d("2027-03-31"))), "2027-04-30");
  eq("leap year Feb 29", iso(nextDueAfter(t, d("2028-01-31"))), "2028-02-29");
}

console.log("\nMONTHLY on the 30th clamps in February");
{
  const t = { cadence: "MONTHLY" as const, interval: 1, anchorDay: 30 };
  eq("Jan 30 -> Feb 28", iso(nextDueAfter(t, d("2027-01-30"))), "2027-02-28");
  eq("Feb 28 -> Mar 30 (recovers the anchor)", iso(nextDueAfter(t, d("2027-02-28"))), "2027-03-30");
}

console.log("\nQUARTERLY on the 10th");
{
  const t = { cadence: "QUARTERLY" as const, interval: 1, anchorDay: 10 };
  eq("from 20 Sep -> 10 Oct", iso(firstDueOnOrAfter(t, d("2026-09-20"))), "2026-10-10");
  eq("next is +3 months", iso(nextDueAfter(t, d("2026-10-10"))), "2027-01-10");
}

console.log("\nEvery 2 months (interval 2)");
{
  const t = { cadence: "MONTHLY" as const, interval: 2, anchorDay: 5 };
  eq("Sep 5 -> Nov 5", iso(nextDueAfter(t, d("2026-09-05"))), "2026-11-05");
}

console.log("\nWEEKDAILY skips the weekend");
{
  const t = { cadence: "WEEKDAILY" as const, interval: 1, anchorDay: null };
  eq("Sat 19 Sep seeds to Mon 21", iso(firstDueOnOrAfter(t, d("2026-09-19"))), "2026-09-21");
  eq("Fri 25 -> Mon 28", iso(nextDueAfter(t, d("2026-09-25"))), "2026-09-28");
  eq("Mon 21 -> Tue 22", iso(nextDueAfter(t, d("2026-09-21"))), "2026-09-22");
}

console.log("\nANNUAL");
{
  const t = { cadence: "ANNUAL" as const, interval: 1, anchorDay: 15 };
  eq("2026 -> 2027", iso(nextDueAfter(t, d("2026-06-15"))), "2027-06-15");
}

console.log("\ndescribeCadence copy");
eq("weekly monday", describeCadence({ cadence: "WEEKLY", interval: 1, anchorDay: 1 }), "Weekly on Monday");
eq("monthly 1st", describeCadence({ cadence: "MONTHLY", interval: 1, anchorDay: 1 }), "Monthly on the 1st");
eq("monthly 31 -> last day", describeCadence({ cadence: "MONTHLY", interval: 1, anchorDay: 31 }), "Monthly on the last day");
eq("monthly 22nd", describeCadence({ cadence: "MONTHLY", interval: 1, anchorDay: 22 }), "Monthly on the 22nd");
eq("monthly 3rd", describeCadence({ cadence: "MONTHLY", interval: 1, anchorDay: 3 }), "Monthly on the 3rd");
eq("one-off", describeCadence({ cadence: "NONE", interval: 1, anchorDay: null }), "One-off");

console.log("\nDuration parsing");
eq("bare minutes", parseDurationInput("45"), 45);
eq("colon", parseDurationInput("1:30"), 90);
eq("h and m", parseDurationInput("1h 15m"), 75);
eq("decimal hours", parseDurationInput("1.5h"), 90);
eq("minutes only", parseDurationInput("30m"), 30);
eq("hours only", parseDurationInput("2h"), 120);
eq("junk rejected", parseDurationInput("soon"), null);
eq("empty rejected", parseDurationInput(""), null);

console.log("\nDuration formatting");
eq("105", formatDuration(105), "1h 45m");
eq("60", formatDuration(60), "1h");
eq("45", formatDuration(45), "45m");
eq("0", formatDuration(0), "0m");
eq("480", formatDuration(480), "8h");

console.log("\nRelative day copy");
{
  const today = d("2026-09-20");
  eq("today", relativeDay(d("2026-09-20"), today), "Today");
  eq("tomorrow", relativeDay(d("2026-09-21"), today), "Tomorrow");
  eq("1 day late", relativeDay(d("2026-09-19"), today), "1 day overdue");
  eq("12 days late", relativeDay(d("2026-09-08"), today), "12 days overdue");
  eq("in 3 days", relativeDay(d("2026-09-23"), today), "in 3 days");
}

console.log("\naddMonths clamping");
eq("31 Jan +1 = 28 Feb", iso(addMonths(d("2027-01-31"), 1)), "2027-02-28");
eq("31 Mar +1 = 30 Apr", iso(addMonths(d("2027-03-31"), 1)), "2027-04-30");

console.log("\nbusinessToday is UTC midnight");
eq("midnight", businessToday().toISOString().slice(10), "T00:00:00.000Z");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
