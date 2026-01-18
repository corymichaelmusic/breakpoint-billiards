# Breakpoint Billiards Rating System (BBRS)

The rating system is an **Elo-derived system** with several enhancements designed to provide fair and accurate player ratings.

---

## Core Formula

### 1. Initial Rating
All players start at **500** (displayed as Breakpoint Level **5.0**)

### 2. Expected Win Probability (Elo Formula)
```
Expected = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
```

### 3. K-Factor (Based on Experience Level)
The K-Factor determines how much a player's rating can change. Less experienced players have higher volatility:

| Racks Played | K-Factor | Category |
|--------------|----------|----------|
| Under 100    | 28       | Provisional |
| 100-300      | 20       | Established |
| Over 300     | 14       | Stable |

### 4. Base Rating Change
```
BaseDelta = K × (ActualOutcome - ExpectedWinProb)
```
Where `ActualOutcome` is **1** for a win, **0** for a loss

### 5. Opponent Strength Scaling
Players earn more for beating stronger opponents and less for beating weaker ones:
```
Scale = 1 + (RatingDifference / 1000)
```
- Clamped between **0.85** (beating weaker) and **1.15** (beating stronger)

### 6. Match Modifier (Margin of Victory)
Compares actual rack differential vs expected:
```
Modifier = 1 + ((ActualRackDiff - ExpectedRackDiff) / 20)
```
- Bonus/penalty of up to **±10%** based on performance vs expectations

### 7. Event Weighting
| Event Type | Weight |
|------------|--------|
| League     | 1.0×   |
| Playoffs   | 1.05×  |
| Tournament | 1.08×  |

### Final Calculation
```
RatingChange = BaseDelta × OpponentScaling × MatchModifier × EventWeight
```

### Display Conversion
The raw rating is converted to a "Breakpoint Level" for display:
```
BreakpointLevel = floor(rating / 10) / 10
```
A rating of **523** displays as **5.2**

---

## Example: Rating 7.9 vs Rating 5.3

### Players
- **Player A**: Breakpoint 7.9 (internal rating: **790**)
- **Player B**: Breakpoint 5.3 (internal rating: **530**)

**Assumptions:** League match, both players "Established" (K = 20)

---

### Step 1: Expected Win Probability

```
Expected_A = 1 / (1 + 10^((530 - 790) / 400))
           = 1 / (1 + 10^(-0.65))
           = 1 / (1 + 0.224)
           = 0.817 (81.7%)

Expected_B = 1 - 0.817 = 0.183 (18.3%)
```

**Player A is heavily favored** with an 81.7% win expectation.

---

### Step 2: Opponent Strength Scaling

```
Scale_A = 1 + (530 - 790) / 1000 = 0.74 → capped at 0.85
Scale_B = 1 + (790 - 530) / 1000 = 1.26 → capped at 1.15
```

- Player A gets **lower scaling (0.85)** for beating a weaker opponent
- Player B gets **higher scaling (1.15)** for beating a stronger opponent

---

### Scenario 1: Player A (7.9) Wins 7-4

**Player A's Rating Change:**
```
BaseDelta_A = 20 × (1 - 0.817) = +3.66
Scaled = 3.66 × 0.85 = +3.11
With match modifier = ~+3 points
```
**Result:** 790 → 793 (still 7.9)

**Player B's Rating Change:**
```
BaseDelta_B = 20 × (0 - 0.183) = -3.66
Scaled = -3.66 × 1.15 = -4.21
With match modifier = ~-4 points
```
**Result:** 530 → 526 (now 5.2)

---

### Scenario 2: Player B (5.3) Upsets and Wins 7-5

**Player B's Rating Change:**
```
BaseDelta_B = 20 × (1 - 0.183) = +16.34
Scaled = 16.34 × 1.15 = +18.79
With match modifier = ~+21 points
```
**Result:** 530 → 551 (now **5.5**!)

**Player A's Rating Change:**
```
BaseDelta_A = 20 × (0 - 0.817) = -16.34
Scaled = -16.34 × 0.85 = -13.89
With match modifier = ~-15 points
```
**Result:** 790 → 775 (now **7.7**)

---

## Summary Table

| Outcome | Player A (7.9) | Player B (5.3) |
|---------|----------------|----------------|
| **A wins 7-4** (expected) | +3 pts → 7.9 | -4 pts → 5.2 |
| **A wins 7-0** (dominant) | +5 pts → 7.9 | -6 pts → 5.2 |
| **B wins 7-5** (upset!) | -15 pts → 7.7 | +21 pts → 5.5 |
| **B wins 7-0** (blowout upset!) | -18 pts → 7.7 | +25 pts → 5.7 |

---

## Key Takeaways

1. **Beating weaker opponents = small gains** - Higher-rated players barely move for expected wins
2. **Upsets are rewarding** - Lower-rated players get massive points for beating higher-rated players
3. **Margin of victory matters** - Winning by more than expected adds up to 10% bonus
4. **The system protects higher-rated players** - Losses to strong upsets hurt less (0.85 scaling)
5. **Lower-rated players risk less** - Expected losses cost fewer points (they weren't favored anyway)

---

*Breakpoint Billiards Rating System v1.0*
