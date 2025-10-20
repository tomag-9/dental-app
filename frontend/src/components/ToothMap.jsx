import React, { useState } from "react";

// Rozšírený zoznam zubných zákrokov (rovnaký ako predtým)
const PROCEDURES = [
  { code: "I", label: "Implantát", color: "#e3f2fd" }, // Svetlomodrá
  { code: "Č", label: "Čistenie", color: "#ffe0b2" }, // Svetlooranžová
  { code: "J", label: "Extrakcia (vytrhnutie)", color: "#ffcdd2" }, // Svetločervená
  { code: "K", label: "Korunka", color: "#ede7f6" }, // Svetlofialová
  { code: "M", label: "Mostík", color: "#bbdefb" }, // Svetlomodrá
  { code: "V", label: "Výplň", color: "#fffde7" }, // Svetložltá
];

// Definuje zuby pre každý kvadrant
const QUADRANTS = {
  Q1: ["18", "17", "16", "15", "14", "13", "12", "11"], 
  Q2: ["21", "22", "23", "24", "25", "26", "27", "28"], 
  Q4: ["48", "47", "46", "45", "44", "43", "42", "41"], 
  Q3: ["31", "32", "33", "34", "35", "36", "37", "38"], 
};

// Pomocná funkcia na získanie dát zákroku
const getProcedureData = (code, proceduresList) => {
  const defaultColor = "rgba(171, 171, 171, 0.2)"; // Svetlá sivá pre default
  const defaultData = proceduresList.find(p => p.code === code);
  return defaultData || { color: defaultColor, label: "Žiaden zákrok" };
};

// =========================================================================
// KOMPONENT ZUBA (Opravená logika farby a textu)
// =========================================================================

const Tooth = ({ id, procedureCode, isSelected, onClick, proceduresList }) => {
    // procedureCode je buď 'I', 'K', atď., alebo null
    const procedureData = getProcedureData(procedureCode, proceduresList);
    
    // Používame farbu vrátenú z getProcedureData
    const color = procedureData.color; 
    const isUpper = id[0] === '1' || id[0] === '2'; 
    
    // Kontajner pre celý zub (ID + Kód)
    const toothWrapperStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '2px 0', 
        minWidth: '40px', 
        cursor: 'pointer',
        border: isSelected ? '2px solid #1976d2' : '1px solid transparent', // Upravené na transparentný border
        borderRadius: '4px',
        boxShadow: isSelected ? '0 0 5px rgba(25, 118, 210, 0.8)' : 'none',
        transition: 'all 0.2s',
        flexGrow: 1, 
    };
    
    // Plocha pre ID zuba
    const idStyle = {
        padding: '2px 4px',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        color: '#333',
        backgroundColor: '#eee',
        width: '100%',
        textAlign: 'center',
        borderBottom: '1px solid #ccc',
        borderRadius: isUpper ? '4px 4px 0 0' : '0 0 4px 4px',
    };

  // Plocha pre KÓD ZÁKROKU
  const procedureStyle = {
    padding: '8px 4px',
    backgroundColor: color,
    color: '#111', // Vždy čierne písmo
    fontWeight: 'bold',
    fontSize: '1rem',
    width: '100%',
    textAlign: 'center',
    borderRadius: isUpper ? '0 0 4px 4px' : '4px 4px 0 0',
    height: '40px', 
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'background 0.2s',
  };


    return (
        <div 
            style={toothWrapperStyle}
            onClick={() => onClick(id)}
            title={procedureCode ? procedureData.label : "Kliknite pre výber zákroku"}
        >
            {isUpper && <div style={idStyle}>{id}</div>}
            <div style={procedureStyle}>
                {procedureCode || ''}
            </div>
            {!isUpper && <div style={idStyle}>{id}</div>}
        </div>
    );
};

// =========================================================================
// ToothMap komponent
// =========================================================================

const ToothMap = ({ editable = false, value, onChange, allowedProcedures }) => {
  const [localProcedures, setLocalProcedures] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [procedureCode, setProcedureCode] = useState("");

  // Always use value as source of truth if provided (for controlled mode, including read-only)
  const proceduresMap = value !== undefined ? value : localProcedures;
  
  const proceduresList = allowedProcedures || PROCEDURES;

  const handleToothClick = (id) => {
    if (!editable) return;
    setSelectedTooth(id);
    // Pri kliknutí načítame existujúci kód, ak existuje, inak prázdny reťazec
    setProcedureCode(proceduresMap[id] || ""); 
  };

  const handleProcedureChange = (e) => {
    setProcedureCode(e.target.value);
  };

  const handleAssign = () => {
    if (!selectedTooth) return;

    // Kód zákroku je buď vybraná hodnota ('I', 'K', atď.) alebo null (ak je to '')
    const codeToAssign = procedureCode === "" ? null : procedureCode;
    
    
    if (editable && onChange) {
      // For controlled mode, create new object with updated tooth
      const newValue = { ...proceduresMap };
      if (codeToAssign === null) {
        // Remove the tooth from the map if setting to null
        delete newValue[selectedTooth];
      } else {
        newValue[selectedTooth] = codeToAssign;
      }
      onChange(newValue);
    } else {
      // For uncontrolled mode
      setLocalProcedures((prev) => {
        const updated = { ...prev };
        if (codeToAssign === null) {
          delete updated[selectedTooth];
        } else {
          updated[selectedTooth] = codeToAssign;
        }
        return updated;
      });
    }
    setSelectedTooth(null);
    setProcedureCode("");
  };

  const handleClear = () => {
    setProcedureCode("");
  };

  // Štýly pre rozloženie (Všetky štyri kvadranty v stĺpci)
  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column', 
    maxWidth: '800px',
    margin: '20px auto',
    padding: '10px',
    border: '3px solid #ccc',
    borderRadius: '8px',
  };

  // Štýl pre jeden riadok kvadrantu
  const quadrantRowStyle = {
    display: 'flex',
    width: '100%',
    padding: '0',
    marginBottom: '0px', 
    borderBottom: '1px dashed #ddd', 
  };
  
  // Štýl pre riadky, kde je potrebné reverzné poradie (Q1, Q4)
  const reverseQuadrantRowStyle = {
      ...quadrantRowStyle,
      flexDirection: 'row-reverse',
  };
  
  // Extra medzera/oddelenie pre vizuálny stred (medzi pravou a ľavou stranou)
  const separatorStyle = {
      height: '30px', 
      width: '100%', 
      margin: '10px 0',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ccc',
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '0.9rem',
      fontWeight: 'bold',
      color: '#555',
  }


  return (
    <>
    <div style={layoutStyle}>
      {/* Q1: Horná pravá (8 -> 1) */}
      <div style={reverseQuadrantRowStyle}>
        {QUADRANTS.Q1.map((id) => (<Tooth key={id} {...{ id, procedureCode: proceduresMap[id], isSelected: selectedTooth === id, onClick: handleToothClick, proceduresList }} />))}
      </div>
      
      {/* Horizontálna stredová čiara */}
      <div style={{ ...quadrantRowStyle, height: '2px', backgroundColor: '#333', margin: '0 0 10px 0', borderBottom: 'none' }} />
      
      {/* Q4: Dolná pravá (8 -> 1) */}
      <div style={reverseQuadrantRowStyle}>
        {QUADRANTS.Q4.map((id) => (<Tooth key={id} {...{ id, procedureCode: proceduresMap[id], isSelected: selectedTooth === id, onClick: handleToothClick, proceduresList }} />))}
      </div>
      
      {/* Q2: Horná ľavá (1 -> 8) */}
      <div style={quadrantRowStyle}>
        {QUADRANTS.Q2.map((id) => (<Tooth key={id} {...{ id, procedureCode: proceduresMap[id], isSelected: selectedTooth === id, onClick: handleToothClick, proceduresList }} />))}
      </div>
      
      {/* Horizontálna stredová čiara */}
      <div style={{ ...quadrantRowStyle, height: '2px', backgroundColor: '#333', margin: '0 0 10px 0', borderBottom: 'none' }} />
      
      {/* Q3: Dolná ľavá (1 -> 8) */}
      <div style={quadrantRowStyle}>
        {QUADRANTS.Q3.map((id) => (<Tooth key={id} {...{ id, procedureCode: proceduresMap[id], isSelected: selectedTooth === id, onClick: handleToothClick, proceduresList }} />))}
      </div>
      
    </div>
    
    {/* Popup na výber zákroku (Modal) - Zostáva rovnaký */}
    {editable && selectedTooth && (
      <>
      <div
          style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              border: "1px solid #1976d2",
              borderRadius: 8,
              padding: 16,
              zIndex: 100,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              minWidth: 250,
          }}
      >
          <div style={{ marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <b>Zub {selectedTooth}</b> - Priradiť zákrok
          </div>
          <select
              value={procedureCode}
              onChange={handleProcedureChange}
              style={{ width: "100%", padding: 8, borderRadius: 4, marginBottom: 10 }}
          >
              <option value="">Vyberte zákrok</option>
              {proceduresList.map((p) => (
                  <option key={p.code} value={p.code}>
                      {p.label}
                  </option>
              ))}
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
              <button
                  style={{ flex: 1, padding: 8, borderRadius: 4, background: "#f44336", color: "#fff", border: "none", cursor: "pointer" }}
                  onClick={handleClear}
              >
                  Vymazať
              </button>
              <button
                  style={{ flex: 1, padding: 8, borderRadius: 4, background: "#1976d2", color: "#fff", border: "none", cursor: "pointer" }}
                  onClick={handleAssign}
              >
                  Priradiť
              </button>
          </div>
      </div>
      <div
          style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              zIndex: 99
          }}
          onClick={() => setSelectedTooth(null)}
      />
      </>
    )}
    </>
  );
};

export default ToothMap;