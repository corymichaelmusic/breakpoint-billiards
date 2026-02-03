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

### 2a. Handicap Adjustment
If the match is played with a **handicap** (where the race targets differ, e.g., 7-5), the systems assumes the handicap perfectly levels the playing field:
- **Expected Win Probability** is forced to **50% (0.5)**.
- This ensures higher-rated players are not penalized for playing against a handicap.

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

### Rating Categories
| Rating | Breakpoint | Category |
|--------|------------|----------|
| 0-344  | 0.0 - 3.4  | Beginner |
| 345-436| 3.5 - 4.3  | Intermediate |
| 437-499| 4.4 - 4.9  | Intermediate+ |
| 500-561| 5.0 - 5.6  | Good League Player |
| 562-624| 5.7 - 6.2  | Advanced |
| 625-686| 6.3 - 6.8  | Advanced+ |
| 687-749| 6.9 - 7.4  | Top Regional |
| 750-875| 7.5 - 8.7  | Semi-Pro |
| 876+   | 8.8+       | World Class |

---

## Example 1: Even Race (Standard Elo)
**Context:** Match played with **NO Handicap** (e.g. Tournament play).
**Expectation:** Player A (Rating 790) is heavily favored (81.7%) vs Player B (530).

### Outcome A: Close Win (7-6)
Player A barely squeaks by.
- **Rack Diff:** +1 (Small margin) -> **+2.5% Bonus**
- **Player A:** **+3 pts** (Small gain, expected win + poor margin)
- **Player B:** **-4 pts** (Small loss)

### Outcome B: Big Win (7-0)
Player A dominates as expected.
- **Rack Diff:** +7 (Large margin) -> **+10% Bonus (Max)**
- **Player A:** **+5 pts** (Maximum possible for this match up)
- **Player B:** **-6 pts**

---

## Example 2: Handicapped Race (New System)
**Context:** League match, Race 7-4.
**Expectation:** **50% Win Probability** (Coin Flip).

### Outcome A: Close Win (7-3)
Player A wins on the hill (P2 had 3, needed 4).
- **Player A:** **+9.4 pts** (Wins coin flip + Margin Bonus)
- **Player B:** **-12.7 pts**

### Outcome B: "Winning Big" (7-0)
Player A shuts out Player B.
- **Player A:** **+9.4 pts** (Still capped at max bonus)
- **Player B:** **-12.7 pts**
*Note: In handicapped matches, the favorite winning often hits the max margin bonus automatically.*

### Outcome C: "Losing Big" (P2 Wins 4-0)
Player B dominates Player A.
- **Player B:** **+14.0 pts** (Wins coin flip + Max Bonus)
- **Player A:** **-11.0 pts** (Loses coin flip + Max Penalty)

---

## Summary Table

| Scenario | Race | Winner | Player A (7.9) | Player B (5.3) |
|----------|------|--------|----------------|----------------|
| **Even Race** | 7-7 | A Wins | **+3 pts** (Expected) | **-4 pts** |
| **Handicap** | 7-4 | A Wins | **+9.5 pts** (Beat Handicap) | **-12.7 pts** |
| **Handicap** | 7-4 | B Wins | **-9.5 pts** (Lost Coin Flip) | **+12.7 pts** |

---

## Key Takeaways

1.  **Handicaps Matter**: If you give spots, the system treats the match as 50/50.
2.  **Beating the Handicap pays**: High-rated players now earn full points for winning handicapped matches (instead of getting 1-2 points).
3.  **Splitting Sets is Safe**: If two players split sets in handicapped play, their ratings will largely remain unchanged.

---

*Breakpoint Billiards Rating System v1.1*
