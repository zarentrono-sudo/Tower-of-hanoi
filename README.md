# Tower of Hanoi

A playable Tower of Hanoi game built with plain HTML, CSS and JavaScript. No installs or build steps.

## Open it in VS Code
1. Unzip the folder.
2. In VS Code choose File > Open Folder and select `tower-of-hanoi`.
3. Install the recommended **Live Server** extension when VS Code asks.
4. Right-click `index.html` and choose **Open with Live Server**.

You can also just double-click `index.html` to play in any browser.

## How to play
Move the whole stack from peg 1 to peg 3. Move one disk at a time and never put a larger disk on a smaller one.

- Click a peg, then click the peg to move to (or drag the top disk)
- Keys: 1, 2, 3 pick pegs, U undo, R restart
- Choose 3 to 8 disks
- Auto-solve shows the optimal solution
- Best scores are saved per disk count in your browser

## Prolog server (optional)
Needs SWI-Prolog installed (https://www.swi-prolog.org). In the VS Code terminal, from this folder:

    swipl server.pl

Then open http://localhost:8080. The server hosts the game and solves the puzzle in Prolog
(`/solve?disks=N` returns the moves as JSON). The **Solve with Prolog** button uses it.
Press Ctrl+C twice (or type `halt.`) to stop.
