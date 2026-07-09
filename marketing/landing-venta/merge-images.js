// Fusiona las capturas reales en la plantilla como data: URIs, sin que el
// base64 (cientos de miles de caracteres) pase por el contexto del agente.
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const templatePath = path.join(dir, "landing-template.html");
const outputPath = path.join(dir, "landing-final.html");
const screenshotsDir = path.join(dir, "screenshots");

function encontrarArchivo(nombreBase) {
  const candidatos = fs
    .readdirSync(screenshotsDir)
    .filter((f) => f.startsWith(nombreBase + "."));
  if (candidatos.length === 0) {
    throw new Error(`No se encontró ningún archivo ${nombreBase}.* en ${screenshotsDir}`);
  }
  return path.join(screenshotsDir, candidatos[0]);
}

function aDataUri(rutaArchivo) {
  const ext = path.extname(rutaArchivo).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext;
  const base64 = fs.readFileSync(rutaArchivo).toString("base64");
  return `data:image/${mime};base64,${base64}`;
}

let html = fs.readFileSync(templatePath, "utf8");
html = html.replace("{{IMG_RESERVAS}}", aDataUri(encontrarArchivo("reservas")));
html = html.replace("{{IMG_HOY}}", aDataUri(encontrarArchivo("panel-hoy")));

fs.writeFileSync(outputPath, html);
console.log("OK — landing-final.html escrito,", html.length, "caracteres");
