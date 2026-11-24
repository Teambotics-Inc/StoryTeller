const playDemo = document.querySelector("#story-demo-play");
const demoPlayer = document.querySelector("#story-demo-player");

playDemo.addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.title = "StoryTeller: Rosetta Stone demo";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.src = "https://www.youtube-nocookie.com/embed/tc_ynR0gMDA?autoplay=1&playsinline=1";
  demoPlayer.append(frame);
  playDemo.hidden = true;
  frame.focus();
}, { once: true });

playDemo.hidden = false;
