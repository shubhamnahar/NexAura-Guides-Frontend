import { scoreCandidate } from "./scoreMatch";

describe("scoreCandidate", () => {
  test("scores matching tag and class", () => {
    document.body.innerHTML = `<button class="cta primary" aria-label="Go">Go</button>`;
    const btn = document.querySelector("button");
    const target = {
      fingerprint: {
        tag: "button",
        classTokens: ["primary"],
        ariaLabel: "Go",
        text: "Go",
      },
    };
    const score = scoreCandidate({ el: btn, target });
    expect(score).toBeGreaterThan(2);
  });
});
