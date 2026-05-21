# Reaction-Diffusion Lab

A real-time interactive Gray-Scott reaction-diffusion simulation rendered in the browser.

## What is this?

The Gray-Scott model simulates two chemicals (A and B) that diffuse, react, and self-organize into mesmerizing Turing patterns — spots, stripes, waves, mazes, and more. These patterns mirror how nature creates zebra stripes, leopard spots, coral structures, and fingerprints.

## Features

- **8 preset patterns:** Spots, Stripes, Worms, Maze, Bubbles, Waves, Chaos, Crystals
- **Click & drag** to seed new chemical concentrations on the grid
- **Real-time controls** for feed rate (f), kill rate (k), brush size, and simulation speed
- **8 color schemes** to recolor the visualization
- **Keyboard shortcuts:** press 1-8 to switch presets, `C` to clear/reset

## How to run

Open `index.html` in any modern browser. No dependencies, no build step.

## The math

```
∂A/∂t = Da∇²A - AB² + f(1 - A)
∂B/∂t = Db∇²B + AB² - (f + k)B
```

- `f` = feed rate — how fast chemical A is replenished
- `k` = kill rate — how fast chemical B decays
- `Da`, `Db` = diffusion rates (fixed)

## Created

RandomHunt project — 2026-05-20