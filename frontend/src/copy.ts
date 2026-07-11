import type { InfoCopy } from "./components/ui";

/**
 * Centralized WHAT/HOW/WHY-IT-MATTERS copy for every metric shown in the
 * dashboard. Kept in one place so wording stays consistent across tabs and
 * so a single review pass can check every claim against the real
 * model/backtest behind it (models/forecaster.py, optimization/rules.py,
 * sustainability/scoring.py).
 */

const HOW_MODEL =
  "Predicted using a HistGradientBoostingRegressor trained on 30 days of factory history, validated with walk-forward backtesting (the model is retrained at each step using only data before that day, then tested on the next 7 held-out days it never trained on).";

export const OVERVIEW: Record<string, InfoCopy> = {
  nextDayCost: {
    what: "The total production cost the model expects tomorrow, across all five production stages.",
    how: HOW_MODEL + " The shaded range shown alongside it is the model's own 10th-90th percentile prediction interval, not a fixed +/- guess.",
    why: "Use this to plan tomorrow's budget and spot cost spikes a day ahead of time, before they show up in actuals.",
  },
  weeklyCost: {
    what: "The sum of the model's expected (mid-point) daily cost forecasts for the next 7 days.",
    how: HOW_MODEL + " This is the sum of each day's expected value, not a separately-modeled weekly total, so day-to-day errors can partially cancel out.",
    why: "Use this for short-term cash flow and procurement planning at a weekly cadence.",
  },
  modelAccuracy: {
    what: "How close the model's total-cost predictions have historically been to what actually happened, expressed as MAPE (mean absolute percentage error) and R2 (share of day-to-day cost variation the model explains, 1.0 = perfect).",
    how: "Computed via walk-forward backtesting on the last 7 days of the 30-day history: the model is trained on everything before a day, predicts that day, then compared against a naive (repeat-yesterday) and seasonal-naive (repeat-same-weekday-last-week) baseline so it can't claim credit for a trend an untrained guess would also catch.",
    why: "A single forecast number is meaningless without knowing how trustworthy it is. Low MAPE means you can act on the forecast directly; high MAPE means treat it as a rough signal and double-check before committing budget.",
  },
  sustainabilityScore: {
    what: "A single 0-100 score summarizing how sustainable today's production mix is (emissions, waste, water, non-renewable resource share) relative to the 30-day factory baseline.",
    how: "Computed by the rule-based sustainability scoring engine from Scope 1/2/3 emissions, waste, water and non-renewable resource share for the day, normalized against the 30-day historical baseline (not a machine-learning prediction itself).",
    why: "Gives plant managers one number to track sustainability trend at a glance, and to flag to leadership or auditors without reading five separate emissions charts.",
  },
  methodOfTheDay: {
    what: "The single highest-priority operational improvement method the system recommends deploying today, out of a fixed catalogue of 9 continuous-improvement methods (Lean, Six Sigma, Predictive Maintenance, Energy Optimization, etc).",
    how: "Chosen by a deterministic rule engine that scores each production stage's predicted cost, cost driver, and priority for the day; the highest-priority stage's recommended method becomes the Method of the Day. The written rationale (and Overview narrative) is then optionally phrased by an LLM, but the LLM never chooses the method, priority, or savings figure - it only explains a decision the rules already made.",
    why: "Tells you the single most impactful action to take today, rather than making you read every stage's recommendation to figure out what matters most.",
  },
};

export const FORECAST: Record<string, InfoCopy> = {
  chartTargetPicker: {
    what: "Switches which forecasted quantity (cost, material usage, waste, emissions) the chart below is showing.",
    how: "Each button corresponds to one independently-modeled target - the model is trained separately per target, so accuracy (MAPE/R2 shown to the right) varies target to target.",
    why: "Different targets have different reliability; check the accuracy readout after switching before treating a chart's forecast as a firm number.",
  },
  accuracyReadout: {
    what: "The backtested accuracy of the model for the currently selected target: MAPE (typical % error), R2 (share of variation explained), and whether the model beat both a naive and seasonal-naive baseline.",
    how: "From the same walk-forward backtest described in the model accuracy tooltip, run separately for this specific target.",
    why: "Tells you exactly how much to trust the chart you're looking at right now - some targets (e.g. total cost) forecast well, others (e.g. water usage) are weaker; see 'How This Works' for the full breakdown.",
  },
  predictionBand: {
    what: "The shaded band around the forecast line is the model's 10th-90th percentile prediction interval - the range the actual value is expected to fall within 80% of the time, not a single guaranteed number.",
    how: "Produced by three separate quantile regression models (10th, 50th/median, 90th percentile) trained on the same history, so the band widens naturally when the model is less certain about a given day.",
    why: "A single point forecast can look more certain than it is. The band tells you how much buffer to build into a budget or plan - a wide band means treat the number as a rough estimate, a narrow band means you can plan more tightly.",
  },
  splitMarker: {
    what: "The dashed vertical line marks where real historical data ends and the forecast begins.",
    how: "It's placed at the last date present in the 30-day historical dataset used to train the model.",
    why: "Makes it immediately visually clear which part of the chart is what actually happened vs. what the model is predicting - so you don't mistake a forecast for a fact.",
  },
};

export const OPTIMIZATION: Record<string, InfoCopy> = {
  predictedCost: {
    what: "The model's forecasted cost for this production stage on this specific day.",
    how: HOW_MODEL + " Stage-level cost targets (e.g. Baking, Packaging) are each modeled independently.",
    why: "Shows where the money is going stage-by-stage, so budget attention goes to the stage that actually drives cost that day rather than the biggest stage on average.",
  },
  contributionPct: {
    what: "What share of that day's total production cost this one stage accounts for.",
    how: "Calculated directly from the stage's predicted cost divided by the sum of all stages' predicted costs for the same day - a simple ratio, not a separate model.",
    why: "Prioritizes attention: a stage that's 40% of daily cost deserves more scrutiny than one that's 5%, even if both have the same absolute rupee value.",
  },
  recommendedMethod: {
    what: "The single continuous-improvement method (out of Lean Manufacturing, JIT, Six Sigma, Predictive Maintenance, Energy Optimization, Kaizen, Supplier Optimization, Recipe Optimization, OEE Improvement) judged most relevant to this stage's dominant cost driver today.",
    how: "Chosen by a deterministic rule engine mapping the stage's dominant cost driver (e.g. energy use, material waste, machine downtime risk) to the method proven to address that driver - not by the LLM, and not by a black-box model.",
    why: "Turns a cost number into a concrete next step your team can actually schedule, instead of leaving you to guess what to do about a cost spike.",
  },
  priority: {
    what: "How urgently this stage's recommendation should be acted on, from Low to Very High.",
    how: "Set by the rule engine from the stage's predicted cost contribution and the size of its estimated savings opportunity - larger, more addressable cost drivers get higher priority.",
    why: "Lets a plant manager triage a list of recommendations under time pressure instead of treating every line item as equally urgent.",
  },
  savingsPct: {
    what: "The estimated percentage (and rupee amount) this stage's cost could be reduced by if the recommended method is adopted.",
    how: "Estimated by the rule engine using typical savings ranges associated with each method and the stage's current cost driver - this is a planning estimate from domain rules, not a machine-learning prediction, and actual savings will vary by execution.",
    why: "Gives a rough business case (in rupees) for whether the recommended action is worth the operational effort of implementing it.",
  },
  rationale: {
    what: "A plain-language explanation of why this specific method was recommended for this stage today.",
    how: "Written by an LLM that explains the rule engine's already-made decision (method, priority, and savings are fixed by the rules beforehand); if the LLM is unavailable, a templated rule-layer explanation is shown instead - see the Rule/LLM badge next to the text.",
    why: "Builds trust in the recommendation by showing the reasoning, not just the output, and helps you explain the decision to others without needing this dashboard open.",
  },
};

export const SUSTAINABILITY: Record<string, InfoCopy> = {
  scope1: {
    what: "Scope 1 emissions: direct greenhouse gas emissions from burning gas on-site (e.g. the oven).",
    how: "Calculated from gas usage quantities using standard emission factors, historically and per forecast day (gas usage itself is forecast by the model; the emissions conversion is a fixed rule, not learned).",
    why: "Direct emissions are usually the most controllable lever a single factory has - reducing gas use here has an immediate, attributable sustainability impact.",
  },
  scope2: {
    what: "Scope 2 emissions: indirect emissions from the electricity the factory purchases from the grid.",
    how: "Calculated from forecasted electricity usage using the grid's emission factor, the same way as Scope 1.",
    why: "Highlights how much of the footprint depends on grid electricity mix vs. on-site fuel - relevant if evaluating renewable power contracts or energy-efficiency projects.",
  },
  scope3: {
    what: "Scope 3 emissions: indirect upstream emissions embedded in purchased materials, primarily packaging and dough ingredients.",
    how: "Calculated from forecasted material quantities using per-material emission factors.",
    why: "Usually the hardest scope to control directly, but the largest lever for a food manufacturer is often supplier/material choice - this number flags when it's worth engaging suppliers.",
  },
  nonRenewableIndex: {
    what: "The share of the day's resource use that comes from non-renewable sources: gas, fossil-grid electricity, and virgin (non-recycled) packaging.",
    how: "A weighted rule-based index (0-100%) computed from the mix of gas, electricity, and packaging material sourced non-renewably that day - not a machine-learning prediction.",
    why: "A single emissions total can look fine even if it's almost entirely fossil-sourced; this index flags long-term supply-chain and energy-contract risk that a raw kgCO2e number hides.",
  },
  waste: {
    what: "Total waste generated that day: ingredient waste, biscuit waste (rejects/scrap), and packaging waste, combined.",
    how: HOW_MODEL + " Waste is forecast as its own modeled target from historical waste quantities.",
    why: "Waste is both a cost (wasted material = wasted money) and a sustainability metric - tracking it flags process quality issues before they show up as a margin problem.",
  },
  water: {
    what: "Water consumption for the day, in kilolitres.",
    how: HOW_MODEL + " Caveat: this is one of the weaker-performing forecast targets in backtesting (negative R2, meaning a flat average would explain the day-to-day pattern about as well as the model does) - see the Model Scorecard tab or 'How This Works' for the full accuracy picture before relying on this number precisely.",
    why: "Water is a regulated and increasingly scrutinized resource in food manufacturing; track it, but treat the exact forecast figure as directional rather than precise given the current data limitations.",
  },
  sustainabilityScore: {
    what: "A single 0-100 score summarizing overall sustainability performance for the day, combining emissions, waste, water, and non-renewable resource share.",
    how: "Computed by the rule-based scoring engine against the 30-day historical baseline (not a machine-learning prediction) - it is a normalized composite, not a raw physical measurement.",
    why: "Gives one trackable number for sustainability trend reporting, without needing to interpret five separate metrics every time.",
  },
  reductionLever: {
    what: "A specific, ranked opportunity to improve the sustainability score, tied to a driver (e.g. gas use, packaging waste) and a suggested method to address it.",
    how: "Generated by the rule engine by identifying which drivers contribute most to the gap between today's score and the best 30-day historical score, then mapping each driver to a relevant improvement method.",
    why: "Converts an abstract score into concrete, ranked actions - tells you which lever to pull first for the biggest sustainability improvement.",
  },
};

export const SCORECARD: Record<string, InfoCopy> = {
  mae: {
    what: "Mean Absolute Error: on average, how far off the model's prediction was from the actual value, in the target's own units (e.g. rupees, kg).",
    how: "Averaged across the walk-forward backtest's held-out days for this target.",
    why: "The most intuitive accuracy number - directly tells you 'expect the forecast to be off by about this much' in real units you can plan around.",
  },
  rmse: {
    what: "Root Mean Squared Error: similar to MAE, but penalizes large individual misses more heavily than small ones.",
    how: "Computed from the same backtest predictions as MAE, but squaring errors before averaging and unsquaring at the end.",
    why: "If RMSE is much larger than MAE for a target, it means the model has occasional big misses rather than uniformly small ones - worth knowing before trusting every single day's number equally.",
  },
  mape: {
    what: "Mean Absolute Percentage Error: the typical prediction error expressed as a percentage of the actual value, so it's comparable across targets with different units.",
    how: "Computed from the same backtest, excluding any day where the actual value was zero (percentage error is undefined there).",
    why: "The easiest number for a non-technical reader to sanity-check - 'MAPE 3%' means predictions are typically within about 3% of what actually happened.",
  },
  r2: {
    what: "R-squared: the share of day-to-day variation in the actual data that the model's predictions explain, from 1.0 (explains all of it) down through 0 (no better than always predicting the average) and into negative territory (worse than the average).",
    how: "Computed from the same backtest predictions vs. actuals.",
    why: "MAE/MAPE can look small on a target that barely moves day to day; R2 tells you whether the model is actually capturing real patterns or just benefiting from a flat, easy-to-guess target. A negative R2 (see water_kl) is an honest flag that this target isn't well-modeled yet.",
  },
  naiveBaseline: {
    what: "The error a trivial 'assume tomorrow equals today' forecast would have on this same held-out data.",
    how: "Computed the same way as the model's own metrics, but using yesterday's actual value as the 'prediction' for each held-out day.",
    why: "Sets a floor: if the model can't beat this simplest possible guess, it isn't earning its complexity for that target.",
  },
  seasonalNaiveBaseline: {
    what: "The error a 'assume today equals the same weekday last week' forecast would have on this same held-out data.",
    how: "Computed the same way, using the value from 7 days earlier as the 'prediction' for each held-out day.",
    why: "With only 30 days of history and a strong injected weekly pattern, this simple rule is a genuinely strong competitor - the model is judged fairly against it rather than against only the weaker naive baseline.",
  },
  beatsBaselines: {
    what: "Whether the model's MAE was lower than both the naive and seasonal-naive baselines' MAE for this target.",
    how: "A direct comparison of the three MAE numbers in this row.",
    why: "A quick trust signal: 'No' doesn't mean the model is bad, it usually means the target has a very strong, easy-to-guess weekly pattern given only 30 days of history - but it does mean a simpler rule of thumb would do just as well or better for that specific number.",
  },
};
