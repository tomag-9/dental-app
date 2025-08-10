import React from "react";
import teethImage from "../assets/teeth.svg"; // SVG ako obrázok

const ToothMap = () => {
  // Zoznam zubov (id + pozícia v %)
  const teeth = [
    { id: "11", top: "20%", left: "15%" },
    { id: "12", top: "22%", left: "20%" },
    { id: "13", top: "25%", left: "25%" },
    // ... sem doplníš všetky zuby s pozíciami
  ];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "800px", margin: "0 auto" }}>
      {/* Obrázok zubov */}
      <img src={teethImage} alt="Tooth Map" style={{ width: "100%", display: "block" }} />

      {/* Dropdowny nad obrázkom */}
      {teeth.map((tooth) => (
        <select
          key={tooth.id}
          style={{
            position: "absolute",
            top: tooth.top,
            left: tooth.left,
            transform: "translate(-50%, -50%)",
            fontSize: "0.8rem",
          }}
        >
          <option value=""></option>
          <option value="z">Z</option>
          <option value="k">K</option>
          <option value="m">M</option>
        </select>
      ))}
    </div>
  );
};

export default ToothMap;
