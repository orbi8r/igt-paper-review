# Dynamic Learning and Optimal Advertising Mechanism for LLM Platforms

Presenter deck by Team MatPat (Shuban Biswas). It plays animated explanations of the paper on a laptop and is paced from a phone.

## Run

You need Node 18 or newer and a browser. Nothing else.

    npm install        # optional, only adds the QR code in the terminal
    ./run.sh           # or: node server.js

The terminal prints a laptop URL and one phone URL per network.

1. Open http://localhost:8787/ on the laptop that drives the projector. Press F for fullscreen.
2. Put the phone on the same wifi or hotspot and open the first phone URL, or scan the QR.
3. On the phone, press NEXT and PREVIOUS. The phone shows what to say, the countdown to the end of the step and the next slide. Keyboard on the laptop also works: Right or Space next, Left previous, R replay step.

Animations run at 2x. Add ?speed=1 to the laptop URL for real time.

## If the phone cannot open the URL

The laptop firewall must allow the port, and the hotspot must not isolate clients.

    sudo ufw allow from 192.168.0.0/16 to any port 8787 proto tcp

Repeat for 10.0.0.0/8 and 172.16.0.0/12 if needed. `PORT=9000 ./run.sh` uses another port, which needs its own rule. Running `./run.sh` again stops the old server first.

## Contents

- `server.js`, `run.sh`: server and phone relay
- `laptop.html`, `phone.html`: the two screens
- `slides.json`: 9 slides, 66 steps, each step is a span of a scene plus its cue text
- `deck_config.json`: cover text
- `web/`: the scene pages and data, with three.js included so it runs offline

The paper is not included.
