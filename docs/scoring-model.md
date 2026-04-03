# Hangya Ant Flight Scoring Model

## Overview

The model predicts the probability of ant nuptial flights for a given location and day. It scores 7 weather factors on a 0--1 scale, then combines them into a single 0--100 score using a weighted geometric mean. The geometric mean ensures that any single poor condition (e.g., heavy rain) has an outsized negative effect on the overall score.

## Season Classification

The model distinguishes spring and summer flight conditions based on calendar month:

- **Spring**: March--May (months 3--5) and shoulder months (Sep--Feb default to spring)
- **Summer**: June--August (months 6--8)

Each season has a distinct flight time window, and several factors use season-specific ideal ranges.

## Flight Time Window

Weather data is averaged over the flight time window for each day:

| Season | Flight Window |
|--------|--------------|
| Spring | 11:00--15:00 |
| Summer | 15:00--20:00 |

All weather factors except Daily Low and Prev. Days are computed as the mean of hourly values within this window.

## Factor Scoring Functions

Each factor maps a weather value to a score in [0, 1] using a **plateau function** with Gaussian tails:

### Plateau Function

For a two-sided interval [lo, hi] with bandwidths $b_L$ and $b_R$:

$$
f(x) = \begin{cases}
0.8 + 0.2 \cos\!\left(\frac{|x - m|}{h} \cdot \frac{\pi}{2}\right) & \text{if } lo \le x \le hi \\[6pt]
0.8 \exp\!\left(-\left(\frac{lo - x}{b_L}\right)^2\right) & \text{if } x < lo \\[6pt]
0.8 \exp\!\left(-\left(\frac{x - hi}{b_R}\right)^2\right) & \text{if } x > hi
\end{cases}
$$

where $m = (lo + hi)/2$ is the midpoint and $h = (hi - lo)/2$ is the half-width.

**Properties**: The score is 1.0 at the center of the interval, 0.8 at the edges, and decays as a Gaussian outside with bandwidth $b$ (the distance at which score drops to $0.8 \cdot e^{-1} \approx 0.29$).

**One-sided variants**:

- $f_{\le}(x; \theta, b)$: Score is 1.0 for $x \le \theta$, then $0.8 \exp(-(x-\theta)^2/b^2)$ above.
- $f_{\ge}(x; \theta, b)$: Score is 1.0 for $x \ge \theta$, then $0.8 \exp(-(\theta-x)^2/b^2)$ below.

### Factor Parameters

| Factor | Type | Season | Parameters | Notes |
|--------|------|--------|------------|-------|
| Temperature | Plateau | Spring | lo=15, hi=25, $b_L$=$b_R$=5 C | Avg during flight window |
| Temperature | Plateau | Summer | lo=24, hi=30, $b_L$=$b_R$=4 C | Avg during flight window |
| Humidity | Plateau | Spring | lo=50, hi=60, $b_L$=$b_R$=10 % | Avg during flight window |
| Humidity | One-sided $\ge$ | Summer | $\theta$=70, $b$=15 % | No upper cap |
| Precipitation | One-sided $\le$ | Both | $\theta$=0, $b$=0.3 mm/h | Avg hourly precip in window |
| Wind | One-sided $\le$ | Both | $\theta$=10, $b$=5 km/h | Avg during flight window |
| Sunlight | One-sided $\le$ | Both | $\theta$=20, $b$=30 % cloud | Avg cloud cover in window |
| Daily Low | One-sided $\ge$ | Spring | $\theta$=5, $b$=3 C | From daily forecast |
| Daily Low | -- | Summer | Always 1.0 | Irrelevant in summer |
| Prev. Days | Composite | Spring | See below | 2-day lookback |
| Prev. Days | Binary | Summer | See below | Rain presence |

### Prev. Days (Spring)

Combines two sub-scores with equal weight:

1. **Daytime temperature**: Average temperature during hours 10--16 over the 2 days before. Scored with $f_{\ge}(T_{avg}; 15, 4)$.
2. **Overnight lows**: Minimum daily low over the previous days. Scored with $f_{\ge}(T_{min}; 5, 3)$.

$$\text{PrevDays}_{\text{spring}} = 0.5 \cdot f_{\ge}(T_{avg}; 15, 4) + 0.5 \cdot f_{\ge}(T_{min}; 5, 3)$$

### Prev. Days (Summer)

Binary: 1.0 if any hour within 24h before or after the target day has precipitation $\ge$ 0.5 mm; 0.3 otherwise.

## Aggregation: Weighted Geometric Mean

The 7 factor scores $s_1, \ldots, s_7$ are combined using a weighted geometric mean:

$$S = 100 \cdot \prod_{i=1}^{7} s_i^{w_i}$$

where the weights $w_i$ sum to 1:

| Factor | Weight $w_i$ |
|--------|-------------|
| Temperature | 0.22 |
| Precipitation | 0.18 |
| Humidity | 0.15 |
| Wind | 0.13 |
| Prev. Days | 0.12 |
| Sunlight | 0.10 |
| Daily Low | 0.10 |

**Why geometric mean?** Unlike an arithmetic (weighted) average, the geometric mean is multiplicative: if any single factor approaches zero, it pulls the entire score toward zero. This reflects the biological reality that ant nuptial flights require *all* conditions to be acceptable --- heavy rain cannot be compensated by perfect temperature.

## Score Labels

| Score Range | Label |
|-------------|-------|
| 80--100 | Excellent |
| 60--79 | Very Good |
| 40--59 | Good |
| 20--39 | Moderate |
| 0--19 | Low |

## Data Source

Hourly weather data from the [Open-Meteo Forecast API](https://open-meteo.com/), including: temperature (2m), relative humidity (2m), precipitation, surface pressure, wind speed (10m), soil moisture (0--1cm), cloud cover. Daily minimum temperature from the daily forecast endpoint. Past 2 days of data are requested for the Prev. Days factor.

## Parameters to Validate

We invite expert review of:

1. **Season boundaries** (currently calendar-based; should latitude matter?)
2. **Flight window hours** (spring 11--15, summer 15--20)
3. **Ideal ranges and bandwidths** for each factor
4. **Weights** in the geometric mean
5. **Prev. Days** logic (warm streak in spring, rain proximity in summer)
6. **Missing factors** (e.g., barometric pressure trend, soil type, species-specific differences)
