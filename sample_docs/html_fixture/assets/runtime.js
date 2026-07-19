const canvas = document.querySelector("#fixture-canvas");
const context = canvas?.getContext("2d");
if (context) {
  context.fillStyle = "#dbeafe";
  context.strokeStyle = "#2563eb";
  context.lineWidth = 3;
  context.fillRect(12, 14, 130, 52);
  context.strokeRect(12, 14, 130, 52);
  context.fillRect(178, 14, 130, 52);
  context.strokeRect(178, 14, 130, 52);
}

fetch("./data.json")
  .then((response) => response.json())
  .then((data) => {
    const output = document.querySelector("#json-result");
    if (output) output.textContent = JSON.stringify(data, null, 2);
  })
  .catch((error) => {
    const output = document.querySelector("#json-result");
    if (output) output.textContent = `JSON fetch failed: ${String(error)}`;
  });
