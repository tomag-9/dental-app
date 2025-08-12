import React from "react";
import teethImage from "../assets/teeth.svg"; // SVG ako obrázok

const ToothMap = () => {
  // Dáta o zuboch (id + pozícia + text) - FDI notation: 11-18 (UR), 21-28 (UL), 31-38 (LL), 41-48 (LR)
  // Positions are based on your initial pattern (e.g., 11 at 3%,46%; 12 at 5%,43%; 13 at 9%,38%); adjust after testing with teethImage
  const teeth = [
    // Upper Right (Quadrant 1: 11-18)
    { id: "11", top: "3%", left: "18%", info: "" },
    { id: "12", top: "9%", left: "18%", info: "" },
    { id: "13", top: "15%", left: "18%", info: "" },
    { id: "14", top: "21%", left: "18%", info: "" },
    { id: "15", top: "27%", left: "18%", info: "" },
    { id: "16", top: "33%", left: "18%", info: "" },
    { id: "17", top: "39%", left: "18%", info: "" },
    { id: "18", top: "45%", left: "18%", info: "" },
    // Upper Left (Quadrant 2: 21-28) - Mirror UR, increasing left
    { id: "21", top: "3%", left: "82%", info: "" },
    { id: "22", top: "9%", left: "82%", info: "" },
    { id: "23", top: "15%", left: "82%", info: "" },
    { id: "24", top: "21%", left: "82%", info: "" },
    { id: "25", top: "27%", left: "82%", info: "" },
    { id: "26", top: "33%", left: "82%", info: "" },
    { id: "27", top: "39%", left: "82%", info: "" },
    { id: "28", top: "45%", left: "82%", info: "" },
    // Lower Left (Quadrant 3: 31-38) - Mirror UL, adjusting top for lower arch
    { id: "31", top: "97%", left: "82%", info: "" },
    { id: "32", top: "91%", left: "82%", info: "" },
    { id: "33", top: "85%", left: "82%", info: "" },
    { id: "34", top: "79%", left: "82%", info: "" },
    { id: "35", top: "73%", left: "82%", info: "" },
    { id: "36", top: "67%", left: "82%", info: "" },
    { id: "37", top: "61%", left: "82%", info: "" },
    { id: "38", top: "55%", left: "82%", info: "" },
    // Lower Right (Quadrant 4: 41-48) - Mirror LR, decreasing left
    { id: "41", top: "97%", left: "18%", info: "" },
    { id: "42", top: "91%", left: "18%", info: "" },
    { id: "43", top: "85%", left: "18%", info: "" },
    { id: "44", top: "79%", left: "18%", info: "" },
    { id: "45", top: "73%", left: "18%", info: "" },
    { id: "46", top: "67%", left: "18%", info: "" },
    { id: "47", top: "61%", left: "18%", info: "" },
    { id: "48", top: "55%", left: "18%", info: "" },
  ];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "800px", margin: "0 auto" }}>
      {/* Obrázok */}
      <img src={teethImage} alt="Tooth Map" style={{ width: "100%", display: "block" }} />

      {/* Info boxy */}
      {teeth.map((tooth) => (
        <div
          key={tooth.id}
          style={{
            position: "absolute",
            top: tooth.top,
            left: tooth.left,
            transform: "translate(-50%, -50%)",
            backgroundColor:
              tooth.info === "I"
                ? "rgba(0, 200, 0, 0.8)"
                : tooth.info === "Č"
                ? "rgba(255, 165, 0, 0.8)"
                : tooth.info === "J"
                ? "rgba(0, 0, 200, 0.8)"
                : tooth.info === "K"
                ? "rgba(200, 0, 200, 0.8)"
                : "rgba(171, 171, 171, 0.8)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
            fontWeight: "bold",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          {tooth.info}
        </div>
      ))}
    </div>
  );
};

export default ToothMap;