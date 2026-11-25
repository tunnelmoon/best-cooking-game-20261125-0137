[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Rank](https://make.fun/badge/best-cooking-game-20261125-0137/tunnelmoon/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Reward](https://make.fun/badge/best-cooking-game-20261125-0137/tunnelmoon/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

# Skillet Rush

A complete cooking game for the [best cooking game bounty](https://make.fun/bounty/best-cooking-game-20261125-0137). You are the lone chef of a tiny bistro on a 150 second dinner rush: cook patties golden on the grill, stack dishes on the plate, and serve every order before its patience runs out.

## How to play

- Move with WASD or arrow keys, or click anywhere to walk there. Click a station to walk to it and use it.
- Space or E uses the nearest station. P pauses.
- Grab buns, lettuce, tomato and cheese from the bins, raw patties from the fridge.
- Put a raw patty on the grill. Take it when the ring turns gold. A forgotten patty burns.
- Stack the dish on the plate, then serve it at the window when it matches an order ticket.
- Serve fast for a tip. Serves in a row build a combo. A missed order costs a star. Three stars and the kitchen closes early.

Menu: Classic (bun, patty, lettuce), Cheesy (bun, patty, cheese), Garden (bun, lettuce, tomato, cheese), Sunrise (bun, patty, tomato, cheese), Double (bun, patty, patty, cheese). New dishes join the menu as the rush heats up.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (no library, no network request). Screenshots are real renders of the game's own code, staged with `?shot=start|play|serve|end&seed=1`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
