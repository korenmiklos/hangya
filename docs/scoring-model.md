# Hangya Ant Flight Scoring Model (v2)

## Overview

The model predicts the probability of ant nuptial flights for a given location and day. It scores 9 weather factors on a 0--1 scale, then combines them via a weighted geometric mean. The geometric mean ensures that any single poor condition pulls the entire score toward zero.

## 1. Thermal Regime Classification

Replaces calendar-based season detection with a thermal regime based on recent temperatures:

$$T_{\text{avg,5d}} = \frac{1}{5}\sum_{i=0}^{4} T_{\text{mean}}(d-i)$$

| Regime | Condition |
|--------|-----------|
| Spring | $10 \le T_{\text{avg,5d}} < 18$ |
| Summer | $T_{\text{avg,5d}} \ge 18$ |

## 2. Dynamic Flight Window

Instead of fixed time intervals, the optimal flight hour is computed from a utility function:

$$u(t) = T(t) - 0.5 \cdot W(t) - 2.0 \cdot P(t)$$

where $T$ is temperature, $W$ is wind speed, and $P$ is precipitation, all at hour $t$.

$$t^* = \arg\max_{t \in [8, 22]} u(t)$$

The averaging window is $[t^* - 2, t^* + 2]$ (5 hours centered on $t^*$). All weather factors except Daily Low, Prev. Days, and Pressure are averaged over this window.

## 3. Scoring Primitives

### Soft plateau (Gaussian tails)

For factors where gradual degradation is appropriate (temperature, humidity, cloud cover, soil moisture):

$$
f(x) = \begin{cases}
0.8 + 0.2 \cos\!\left(\frac{|x - m|}{h} \cdot \frac{\pi}{2}\right) & \text{if } lo \le x \le hi \\[6pt]
0.8 \exp\!\left(-\left(\frac{lo - x}{b_L}\right)^2\right) & \text{if } x < lo \\[6pt]
0.8 \exp\!\left(-\left(\frac{x - hi}{b_R}\right)^2\right) & \text{if } x > hi
\end{cases}
$$

### Hard constraint (quartic tails)

For factors where exceeding the threshold should rapidly suppress the score (wind, current precipitation):

$$f_{\text{hard}}(x; \theta, b) = \begin{cases}
1 & \text{if } x \le \theta \\
0.8 \exp\!\left(-\left(\frac{x - \theta}{b}\right)^4\right) & \text{if } x > \theta
\end{cases}$$

### One-sided (soft)

$$f_{\ge}(x; \theta, b) = \begin{cases}
1 & \text{if } x \ge \theta \\
0.8 \exp\!\left(-\left(\frac{\theta - x}{b}\right)^2\right) & \text{if } x < \theta
\end{cases}$$

## 4. Factor Definitions

### Temperature (soft plateau)

| Regime | Interval | Bandwidth |
|--------|----------|-----------|
| Spring | [13, 23] C | $b_L = b_R = 5$ |
| Summer | [22, 30] C | $b_L = b_R = 4$ |

### Rain Trigger (post-rain, critical)

Effective recent rainfall with exponential decay:

$$R = \sum_{h=1}^{48} P(t^* - h) \cdot e^{-h/\tau}, \quad \tau = 6$$

Scored with soft plateau on $R$: optimal range $[0.5, 3]$ mm effective rain, $b_L = 0.5$, $b_R = 2$.

**Hard veto**: If mean precipitation during flight window $> 0.2$ mm/h, score is set to 0.

### Humidity (soft plateau, with rain interaction)

| Regime | Type | Parameters |
|--------|------|------------|
| Spring | Plateau | [50, 60]%, $b = 10$ |
| Summer | One-sided $\ge$ | $\theta = 70$%, $b = 15$ |

The raw humidity score is multiplied by $\max(\text{rainScore}, 0.3)$ to model the interaction between humidity and recent rainfall.

### Wind (hard constraint)

$$f_{\text{wind}}(w) = f_{\text{hard}}(w; \theta = 10 \text{ km/h}, b = 5)$$

Uses quartic decay for rapid suppression above 10 km/h.

### Cloud Cover (soft plateau, two-sided)

$$f_{\text{cloud}}(c) = f(c; lo = 30, hi = 70, b_L = 15, b_R = 20)$$

Not one-sided: both very clear and very overcast are suboptimal.

### Daily Low (one-sided, spring only)

$$f_{\text{low}} = f_{\ge}(T_{\min}; \theta = 5 \text{ C}, b = 3)$$

Score is 1.0 in summer (irrelevant).

### Barometric Pressure Trend (new)

Computed at $t^*$:

$$\Delta P_{6h} = P(t^*) - P(t^* - 6), \quad \Delta P_{24h} = P(t^*) - P(t^* - 24)$$

Preferred pattern: prior drop then stabilization.

$$f_{\text{pressure}} = f_{\ge}(-\Delta P_{24h};\, \theta = 2\text{ hPa},\, b = 3) \;\cdot\; f_{\ge}(\Delta P_{6h};\, \theta = 0,\, b = 2)$$

### Soil Moisture (new)

Shallow soil moisture (0--1 cm depth):

$$f_{\text{soil}} = f(M;\, lo = 0.15,\, hi = 0.35,\, b_L = 0.08,\, b_R = 0.1) \quad [\text{m}^3/\text{m}^3]$$

Suppressed if very dry ($< 0.1$) or saturated ($> 0.45$).

### Prev. Days

**Spring** (3--5 day lookback):

$$\text{PrevDays}_{\text{spring}} = 0.5 \cdot f_{\ge}(\bar{T}_{\text{daytime}};\, 15,\, 4) + 0.5 \cdot f_{\ge}(T_{\text{min,prev}};\, 5,\, 3)$$

where $\bar{T}_{\text{daytime}}$ is the mean temperature during hours 10--16 over the preceding 3--5 days, and $T_{\text{min,prev}}$ is the minimum daily low over the same period.

**Summer**: Binary --- 1.0 if any hour within 24h before/after has $P \ge 0.5$ mm; 0.3 otherwise.

## 5. Aggregation: Weighted Geometric Mean

$$S = 100 \cdot \exp\!\left(\sum_{i=1}^{9} w_i \cdot \ln(s_i + 10^{-6})\right)$$

| Factor | Weight $w_i$ |
|--------|-------------|
| Rain Trigger | 0.19 |
| Temperature | 0.17 |
| Prev. Days | 0.14 |
| Wind | 0.13 |
| Humidity | 0.10 |
| Pressure Trend | 0.08 |
| Cloud Cover | 0.07 |
| Daily Low | 0.06 |
| Soil Moisture | 0.06 |
| **Total** | **1.00** |

The $10^{-6}$ floor prevents $\ln(0)$ while preserving the sharp penalty for near-zero scores.

## 6. Score Labels

| Score Range | Label |
|-------------|-------|
| 80--100 | Excellent |
| 60--79 | Very Good |
| 40--59 | Good |
| 20--39 | Moderate |
| 0--19 | Low |

## 7. Data Source

Hourly weather data from the [Open-Meteo Forecast API](https://open-meteo.com/): temperature (2m), relative humidity (2m), precipitation, surface pressure, wind speed (10m), soil moisture (0--1cm), cloud cover. Daily minimum and mean temperatures from the daily endpoint. Past 7 days of data are requested for the thermal regime and prev. days factors.

## 8. Parameters to Validate

1. **Thermal regime thresholds** (10/18 C for spring/summer transition)
2. **Utility function coefficients** for dynamic flight window ($-0.5W$, $-2P$)
3. **Rain trigger**: exponential decay $\tau = 6$, optimal range [0.5, 3] mm, veto at 0.2 mm/h
4. **Quartic vs. Gaussian decay**: is the sharper wind cutoff biologically justified?
5. **Cloud cover**: is two-sided [30, 70]% correct, or should clear sky always score higher?
6. **Pressure trend**: does the drop-then-stabilize pattern match observed flights?
7. **Soil moisture range** [0.15, 0.35] m³/m³ and its relevance to flight timing
8. **Weights** in the geometric mean
9. **Humidity × rain interaction**: is multiplicative coupling the right model?

## 9. Future Extensions

- Species mixture: $S = \max_k S_k$ across species-specific parameter sets
- Calibration using observed flight logs
