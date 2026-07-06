import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/templates";

describe("renderTemplate", () => {
  it("sustituye todas las variables", () => {
    expect(
      renderTemplate("Hola {{nombre}}, tu cita el {{fecha}} a las {{hora}}", {
        nombre: "Lucía",
        fecha: "7 de julio",
        hora: "11:00",
      })
    ).toBe("Hola Lucía, tu cita el 7 de julio a las 11:00");
  });

  it("sustituye apariciones repetidas de la misma variable", () => {
    expect(
      renderTemplate("{{nombre}} y otra vez {{nombre}}", { nombre: "Ana" })
    ).toBe("Ana y otra vez Ana");
  });

  it("variable sin valor queda vacía, no {{literal}}", () => {
    expect(renderTemplate("Hola {{nombre}}", { nombre: null })).toBe("Hola ");
  });

  it("texto null devuelve cadena vacía", () => {
    expect(renderTemplate(null, { nombre: "Ana" })).toBe("");
  });

  it("variables no declaradas en vars se quedan tal cual", () => {
    expect(renderTemplate("Hola {{desconocida}}", { nombre: "Ana" })).toBe(
      "Hola {{desconocida}}"
    );
  });
});
