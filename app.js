const DEMO_STATES = {
  crutch: {
    metric: "48h unaided retention: ~18% (illusion of competence)",
    good: false,
    steps: [
      {
        role: "Standard Chatbot",
        cls: "msg-ai",
        text: "Train 1 gets a 2-hour head start, so it travels 60 x 2 = 120 km. The closing speed is 90 - 60 = 30 km/h. Divide 120 by 30 = 4 hours. Final answer: 4 hours."
      },
      {
        role: "Student Reaction",
        cls: "msg-student",
        text: "Oh, makes total sense! Next question."
      },
      {
        role: "48 Hours Later (Closed-Book Exam, No AI)",
        cls: "msg-outcome",
        text: "A slightly rewritten problem appears on the real exam. The student never practiced setting up the head-start distance themselves, panics under the timer, and guesses wrong."
      }
    ],
    choices: []
  },
  unaided: {
    metric: "48h unaided retention: tracked on mutated closed-book problems",
    good: true,
    steps: [
      {
        role: "Unaided Tutor (Withholds Answer)",
        cls: "msg-ai",
        text: "Before any math: when Train 2 finally leaves the station, how far ahead is Train 1 already?"
      }
    ],
    branches: {
      "120 km (60 km/h for 2 hours)": [
        {
          role: "Student Attempt",
          cls: "msg-student",
          text: "120 km, because 60 km/h times 2 hours is 120 km."
        },
        {
          role: "Unaided Tutor (Next Step)",
          cls: "msg-ai",
          text: "Exact. Now every hour both trains move, how much of that 120 km gap disappears?"
        },
        {
          role: "Student Insight",
          cls: "msg-student",
          text: "30 km every hour (90 minus 60), so 120 divided by 30 is 4 hours."
        },
        {
          role: "48 Hours Later (Mutated No-AI Proof Check)",
          cls: "msg-outcome is-good",
          text: "Unaided resurfaces the same relative-speed principle two days later with different speeds and a runner scenario, zero hints allowed. Student solves it cold and locks the concept."
        }
      ],
      "I am stuck, just tell me": [
        {
          role: "Student Attempt",
          cls: "msg-student",
          text: "I am stuck, just tell me the answer."
        },
        {
          role: "Unaided Tutor (Refuses Crutch)",
          cls: "msg-ai",
          text: "No shortcut. Picture just Train 1 driving for 1 hour at 60 km/h (60 km). Now let it drive one more hour before Train 2 starts. Total distance?"
        },
        {
          role: "Student Recovery",
          cls: "msg-student",
          text: "120 km. And Train 2 gains 30 km every hour, so 4 hours!"
        },
        {
          role: "48 Hours Later (Mutated No-AI Proof Check)",
          cls: "msg-outcome is-good",
          text: "Because the student actually derived the gap step instead of reading a finished answer, the memory trace sticks. Verified two days later on a fresh closed-book problem."
        }
      ]
    }
  }
};

let currentMode = "crutch";
let chosenBranch = null;

const feedEl = document.getElementById("demo-feed");
const controlsEl = document.getElementById("demo-controls");
const metricEl = document.getElementById("demo-metric");
const tabs = document.querySelectorAll(".demo-tab");

function renderMessage(item) {
  const div = document.createElement("div");
  div.className = `msg ${item.cls}`;
  div.innerHTML = `<div class="msg-role">${item.role}</div><div>${item.text}</div>`;
  return div;
}

function renderDemo() {
  const cfg = DEMO_STATES[currentMode];
  metricEl.textContent = cfg.metric;
  metricEl.classList.toggle("is-good", cfg.good);

  feedEl.innerHTML = "";
  controlsEl.innerHTML = "";

  cfg.steps.forEach((step) => feedEl.appendChild(renderMessage(step)));

  if (currentMode === "crutch") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = "Switch to Unaided Loop ->";
    btn.addEventListener("click", () => setMode("unaided"));
    controlsEl.appendChild(btn);
    return;
  }

  if (!chosenBranch) {
    Object.keys(cfg.branches).forEach((label, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = idx === 0 ? "btn btn-primary" : "btn btn-secondary";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        chosenBranch = label;
        renderDemo();
      });
      controlsEl.appendChild(btn);
    });
  } else {
    cfg.branches[chosenBranch].forEach((step) => feedEl.appendChild(renderMessage(step)));
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn-secondary";
    resetBtn.textContent = "Try the other student reply";
    resetBtn.addEventListener("click", () => {
      chosenBranch = null;
      renderDemo();
    });
    controlsEl.appendChild(resetBtn);
  }
}

function setMode(mode) {
  currentMode = mode;
  chosenBranch = null;
  tabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderDemo();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

const copyBtn = document.getElementById("copy-clone");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("git clone https://github.com/foustie/unaided-lab.git");
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy clone command";
      }, 1800);
    } catch {
      copyBtn.textContent = "Copy failed";
    }
  });
}

renderDemo();
