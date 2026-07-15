"use client";

import { useEffect, useRef, useState } from "react";

type MeterState = "idle" | "ok" | "near" | "over";

const steps = [
  ["Escolha um local aberto", "Piso plano, sem paredes ou veículos a menos de 3 m. Evite vento e ruído de fundo."],
  ["Aqueça o motor", "Deixe o veículo em temperatura normal de funcionamento, em ponto morto e com freio acionado."],
  ["Posicione o celular", "A 50 cm da saída do escapamento, na mesma altura e a 45°, sem ficar na frente dos gases."],
  ["Acelere na rotação correta", "Use ¾ da rotação de potência máxima. Em casos específicos, consulte o manual e a NBR 9714."],
  ["Meça três vezes", "Mantenha a rotação estável por alguns segundos. Use o maior resultado e compare com o limite."],
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [db, setDb] = useState(0);
  const [peak, setPeak] = useState(0);
  const [limit, setLimit] = useState(95);
  const [preset, setPreset] = useState("passeio");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const audioRef = useRef<{ctx: AudioContext; stream: MediaStream; raf: number} | null>(null);

  const status: MeterState = !running && peak === 0 ? "idle" : db > limit ? "over" : db > limit - 3 ? "near" : "ok";
  const label = status === "over" ? "Acima do limite" : status === "near" ? "Atenção: perto do limite" : status === "ok" ? "Dentro do limite" : "Pronto para medir";

  function choosePreset(value: string) {
    setPreset(value);
    if (value === "passeio") setLimit(95);
    if (value === "traseiro") setLimit(103);
    if (value === "moto") setLimit(99);
  }

  async function startMeter() {
    try {
      setError(""); setPeak(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = .72;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0; for (const sample of data) sum += sample * sample;
        const rms = Math.sqrt(sum / data.length);
        const next = Math.max(35, Math.min(125, 100 + offset + 20 * Math.log10(Math.max(rms, .00001))));
        setDb(Number(next.toFixed(1))); setPeak(p => Math.max(p, Number(next.toFixed(1))));
        if (audioRef.current) audioRef.current.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, stream, raf: requestAnimationFrame(tick) };
      setRunning(true);
    } catch {
      setError("Não foi possível acessar o microfone. Abra o site em HTTPS e permita o uso do microfone.");
    }
  }

  function stopMeter() {
    const audio = audioRef.current;
    if (audio) { cancelAnimationFrame(audio.raf); audio.stream.getTracks().forEach(t => t.stop()); audio.ctx.close(); }
    audioRef.current = null; setRunning(false); setDb(peak);
  }

  useEffect(() => () => { if (audioRef.current) { cancelAnimationFrame(audioRef.current.raf); audioRef.current.stream.getTracks().forEach(t => t.stop()); } }, []);

  return (
    <main>
      <header className="nav"><a className="brand" href="#top"><img src="./logo.png" alt="" /><span>EscapaLegal</span></a><a className="navLink" href="#como-testar">Como testar</a></header>
      <section className="hero" id="top">
        <div className="eyebrow">TRIAGEM SONORA PELO CELULAR</div>
        <h1>Seu escapamento<br/><em>fala dentro da lei?</em></h1>
        <p className="lead">Faça uma verificação orientativa em poucos minutos. O EscapaLegal guia o posicionamento, mede o som e compara com a referência selecionada.</p>
        <a className="primary" href="#medidor">Iniciar verificação <span>↘</span></a>
        <div className="heroArt"><img src="./logo.png" alt="Símbolo do EscapaLegal"/><span className="ring r1"/><span className="ring r2"/></div>
      </section>

      <section className="meterSection" id="medidor">
        <div className="sectionHead"><span>01 — MEDIDOR</span><h2>Ouça. Meça.<br/>Compare.</h2><p>Escolha a referência antes de começar. O resultado muda de cor conforme a proximidade do limite.</p></div>
        <div className={`meterCard ${status}`}>
          <div className="meterTop"><span>LEITURA AO VIVO</span><span className="live"><i/> {running ? "MIC ATIVO" : "MIC DESLIGADO"}</span></div>
          <div className="readout"><strong>{db ? db.toFixed(1) : "—"}</strong><span>dB(A)*</span></div>
          <div className="status"><i/>{label}</div>
          <div className="scale"><span style={{width: `${Math.min(100, Math.max(0, (db - 35) / 90 * 100))}%`}}/><b style={{left:`${(limit-35)/90*100}%`}}/></div>
          <div className="scaleLabels"><span>35</span><span>Limite {limit}</span><span>125</span></div>
          <button className="measureBtn" onClick={running ? stopMeter : startMeter}>{running ? "Parar e salvar pico" : "Permitir microfone e medir"}</button>
          {peak > 0 && <p className="peak">Maior leitura: <strong>{peak.toFixed(1)} dB(A)*</strong></p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="settings">
          <label>Referência do veículo<select value={preset} onChange={e=>choosePreset(e.target.value)}><option value="passeio">Carro de passeio, motor dianteiro — 95 dB(A)</option><option value="traseiro">Carro de passeio, motor traseiro — 103 dB(A)</option><option value="moto">Motocicleta / similar — 99 dB(A)</option><option value="manual">Valor informado no manual / fabricante</option></select></label>
          {preset === "manual" && <label>Limite do fabricante + 3 dB(A)<input type="number" min="70" max="120" value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label>}
          <label>Calibração do celular <span>{offset > 0 ? "+" : ""}{offset} dB</span><input type="range" min="-20" max="20" value={offset} onChange={e=>setOffset(Number(e.target.value))}/></label>
          <p>* Microfones de celulares não são decibelímetros calibrados e podem aplicar ganho automático. Calibre ao lado de um aparelho confiável para melhorar a estimativa.</p>
        </div>
      </section>

      <section className="steps" id="como-testar"><div className="sectionHead light"><span>02 — PROCEDIMENTO</span><h2>Teste do jeito certo.</h2><p>Segurança primeiro: faça o procedimento ao ar livre, nunca em garagem fechada.</p></div><div className="stepList">{steps.map((s,i)=><article key={s[0]}><b>{String(i+1).padStart(2,"0")}</b><div><h3>{s[0]}</h3><p>{s[1]}</p></div></article>)}</div></section>

      <section className="law"><div><span>03 — REFERÊNCIA LEGAL</span><h2>O número certo depende do veículo.</h2></div><div className="lawText"><p>Quando existe valor de ruído parado declarado pelo fabricante, a fiscalização usa esse valor acrescido de <strong>3 dB(A)</strong>. Na falta dele, a Resolução CONAMA 418/2009 traz referências por categoria — 95 dB(A) para automóvel de passeio com motor dianteiro.</p><p>Uma medição oficial segue a ABNT NBR 9714 e usa equipamento calibrado pelo INMETRO/RBC. Este app é uma triagem educativa e não emite laudo.</p><div className="links"><a href="https://www.ibama.gov.br/sophia/cnia/legislacao/CONAMA/RE0418-251109.PDF" target="_blank" rel="noreferrer">Resolução CONAMA 418/2009 ↗</a><a href="https://www.gov.br/participamaisbrasil/consolidacao-das-normas-sobre-a-fiscalizacao-pelas-autoridades-de-transito" target="_blank" rel="noreferrer">Normas de fiscalização ↗</a></div></div></section>
      <footer><div className="brand"><img src="./logo.png" alt=""/><span>EscapaLegal</span></div><p>Meça com consciência. Dirija com respeito.</p><small>Ferramenta educativa — não substitui inspeção oficial.</small></footer>
    </main>
  );
}
