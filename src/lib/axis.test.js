import { test } from "node:test";
import assert from "node:assert/strict";
import { niceTicks, stepDecimals, monthTicks, thinForDrawing } from "./axis.js";

test("niceTicks picks round steps instead of an even split of the range", () => {
  // A month of USD/JPY: recharts' own split gave 156.75, 157.30, 157.85...
  const jpy = niceTicks([156.07, 158.38]);
  assert.deepEqual(jpy.ticks, [156, 156.5, 157, 157.5, 158, 158.5]);
  assert.deepEqual(jpy.domain, [156, 158.5]);
  assert.equal(jpy.decimals, 1);
  const wheat = niceTicks([552, 770]);
  assert.deepEqual(wheat.ticks, [550, 600, 650, 700, 750, 800]);
  assert.equal(wheat.decimals, 0);
});

test("niceTicks covers every value and does not pad an exact tick", () => {
  const t = niceTicks([100, 150, 200]);
  assert.equal(t.domain[0], 100);
  assert.equal(t.domain[1], 200);
  const eur = niceTicks([1.1114, 1.2024]);
  assert.ok(eur.domain[0] <= 1.1114 && eur.domain[1] >= 1.2024);
  assert.equal(eur.step, 0.025);
  assert.equal(eur.decimals, 3);
});

test("niceTicks handles flat, empty and junk input", () => {
  assert.equal(niceTicks([]), null);
  assert.equal(niceTicks([null, "", NaN]), null);
  const flat = niceTicks([1, 1]);
  assert.ok(flat.domain[0] < 1 && flat.domain[1] > 1);
  // A zero is a value, not a gap.
  assert.equal(niceTicks([0, 4800]).domain[0], 0);
});

test("stepDecimals is the precision a step needs", () => {
  assert.equal(stepDecimals(50), 0);
  assert.equal(stepDecimals(2.5), 1);
  assert.equal(stepDecimals(0.25), 2);
  assert.equal(stepDecimals(0.0005), 4);
});

test("monthTicks labels each month once, skipping the partial first month", () => {
  const dates = ["2025-11-20", "2025-11-28", "2025-12-01", "2025-12-15", "2025-12-31", "2026-01-02", "2026-01-30"];
  assert.deepEqual(monthTicks(dates), ["2025-12-01", "2026-01-02"]);
});

test("monthTicks strides long ranges on calendar months", () => {
  const dates = [];
  for (let y = 2016; y <= 2026; y += 1) for (let m = 1; m <= 12; m += 1) dates.push(`${y}-${String(m).padStart(2, "0")}-03`);
  const yearly = monthTicks(dates, 12);
  assert.ok(yearly.length <= 12);
  assert.ok(yearly.every((d) => d.slice(5, 7) === "01"), "a decade labels Januaries");
  const phone = monthTicks(dates, 6);
  assert.ok(phone.length <= 6 && phone.length > 0);
});

test("thinForDrawing keeps the latest row and leaves short series alone", () => {
  const rows = Array.from({ length: 3653 }, (_, i) => ({ i }));
  const thin = thinForDrawing(rows, 600);
  assert.ok(thin.length <= 600 && thin.length > 500);
  assert.equal(thin[thin.length - 1].i, 3652);
  const short = [{ i: 0 }, { i: 1 }];
  assert.equal(thinForDrawing(short, 600), short);
  assert.deepEqual(thinForDrawing(null), []);
});
