"use client";

import { useEffect, useRef, useState } from "react";

const instructions = [
  { kicker: "Antes de começar", title: "Vamos verificar seu escapamento", text: "O teste leva cerca de 2 minutos. Você vai precisar do carro ligado, do celular e de um local aberto e silencioso.", icon: "2 min" },
  { kicker: "Segurança", title: "Vá para um local aberto", text: "Nunca faça o teste em garagem fechada. Estacione em piso plano, coloque o câmbio em ponto morto e acione o freio de estacionamento.", icon: "AR LIVRE" },
  { kicker: "Distância", title: "Afaste-se de obstáculos", text: "Deixe pelo menos 3 metros entre o escapamento e paredes, muros, carros ou outros objetos que possam refletir o som.", icon: "3 m" },
  { kicker: "Posição do celular", title: "Fique a 50 cm do escapamento", text: "Segure o celular na mesma altura da saída, formando um ângulo de 45°. Não fique diretamente na frente dos gases.", icon: "50 cm · 45°" },
  { kicker: "Preparação do motor", title: "Aqueça e estabilize o motor", text: "Espere o motor chegar à temperatura normal. Durante a medição, use ¾ da rotação de potência máxima indicada no manual.", icon: "¾ RPM" },
];

export default function Home() {
  const [step, setStep] = useState(0);
  const [limit, setLimit] = useState(95);
  const [preset, setPreset] = useState("passeio");
  const [offset, setOffset] = useState(0);
  const [running, setRunning] = useState(false);
  const [db, setDb] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState("");
  const audioRef = useRef<{ctx: AudioContext; stream: MediaStream; raf: number} | null>(null);
  const total = 8;

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) { cancelAnimationFrame(audio.raf); audio.stream.getTracks().forEach(t => t.stop()); void audio.ctx.close(); }
    audioRef.current = null;
    setRunning(false);
  };

  async function startMeter() {
    try {
      setError(""); setPeak(0); setDb(0);
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = .72; source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum=0; for(const sample of data) sum += sample*sample;
        const rms=Math.sqrt(sum/data.length);
        const next=Math.max(35,Math.min(125,100+offset+20*Math.log10(Math.max(rms,.00001))));
        const value=Number(next.toFixed(1)); setDb(value); setPeak(p=>Math.max(p,value));
        if(audioRef.current) audioRef.current.raf=requestAnimationFrame(tick);
      };
      audioRef.current={ctx,stream,raf:requestAnimationFrame(tick)}; setRunning(true);
    } catch { setError("Permita o acesso ao microfone para continuar."); }
  }

  function finishTest(){ stopAudio(); setDb(peak); setStep(7); }
  function restart(){ stopAudio(); setStep(0); setDb(0); setPeak(0); setError(""); }
  function next(){ setStep(s=>Math.min(total-1,s+1)); }
  function back(){ if(step===6 && running) stopAudio(); setStep(s=>Math.max(0,s-1)); }
  function selectPreset(value:string){ setPreset(value); if(value==="passeio")setLimit(95); if(value==="traseiro")setLimit(103); if(value==="moto")setLimit(99); }
  useEffect(()=>()=>stopAudio(),[]);

  const result = peak > limit ? "over" : peak > limit-3 ? "near" : "ok";
  const resultTitle = result==="over" ? "Acima da referência" : result==="near" ? "Muito perto do limite" : "Dentro da referência";

  return <main className="wizard">
    <header><button className="logo" onClick={restart}><img src="./logo.png" alt=""/><span>EscapaLegal</span></button><span className="counter">{step+1} de {total}</span></header>
    <div className="progress"><span style={{width:`${((step+1)/total)*100}%`}}/></div>

    <section className="screen" aria-live="polite">
      {step <= 4 && <div className="instruction">
        <div className="visual"><span>{instructions[step].icon}</span></div>
        <p className="kicker">{instructions[step].kicker}</p>
        <h1>{instructions[step].title}</h1>
        <p className="copy">{instructions[step].text}</p>
        {step===3 && <div className="diagram"><i className="phone">CELULAR</i><span>50 cm</span><i className="pipe">ESCAPAMENTO</i></div>}
      </div>}

      {step===5 && <div className="formStep">
        <p className="kicker">Referência</p><h1>Qual é o seu veículo?</h1><p className="copy">Isso define o valor usado na comparação.</p>
        <div className="choices">
          <button className={preset==="passeio"?"selected":""} onClick={()=>selectPreset("passeio")}><b>Carro de passeio</b><span>Motor dianteiro · 95 dB(A)</span></button>
          <button className={preset==="traseiro"?"selected":""} onClick={()=>selectPreset("traseiro")}><b>Carro de passeio</b><span>Motor traseiro · 103 dB(A)</span></button>
          <button className={preset==="moto"?"selected":""} onClick={()=>selectPreset("moto")}><b>Motocicleta</b><span>Referência geral · 99 dB(A)</span></button>
          <button className={preset==="manual"?"selected":""} onClick={()=>setPreset("manual")}><b>Tenho o valor do manual</b><span>Usar limite específico + 3 dB(A)</span></button>
        </div>
        {preset==="manual" && <label className="manual">Limite final em dB(A)<input type="number" min="70" max="120" value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label>}
        <details><summary>Calibrar o celular</summary><label>Ajuste: {offset>0?"+":""}{offset} dB<input type="range" min="-20" max="20" value={offset} onChange={e=>setOffset(Number(e.target.value))}/></label></details>
      </div>}

      {step===6 && <div className="testStep">
        <p className="kicker">Medição</p><h1>{running ? "Mantenha a rotação" : "Tudo pronto para medir"}</h1>
        <p className="copy">Faça 3 medições. Mantenha o celular na posição indicada e toque no botão abaixo.</p>
        <div className={`gauge ${db>limit?"over":db>limit-3?"near":"ok"}`}><strong>{db?db.toFixed(1):"—"}</strong><span>dB(A)*</span><small>Limite: {limit} dB(A)</small></div>
        {!running ? <button className="start" onClick={startMeter}>Ativar microfone</button> : <button className="stop" onClick={finishTest}>Finalizar medição</button>}
        {running && <div className="listening"><i/> Ouvindo… maior leitura: {peak.toFixed(1)} dB(A)</div>}
        {error && <p className="error">{error}</p>}
      </div>}

      {step===7 && <div className={`result ${result}`}>
        <div className="resultIcon">{result==="ok"?"✓":result==="near"?"!":"×"}</div><p className="kicker">Resultado orientativo</p><h1>{resultTitle}</h1>
        <div className="resultNumbers"><strong>{peak.toFixed(1)}</strong><span>dB(A)*</span><small>Referência selecionada: {limit} dB(A)</small></div>
        <p className="copy">{result==="over"?"Evite circular antes de verificar o escapamento com um profissional e equipamento calibrado.":result==="near"?"Repita o teste em um local mais silencioso e considere uma avaliação profissional.":"A leitura estimada ficou abaixo da referência selecionada."}</p>
        <div className="notice">* O celular fornece apenas uma estimativa. Este resultado não é laudo e não substitui fiscalização ou inspeção com equipamento calibrado.</div>
        <button className="again" onClick={restart}>Fazer novo teste</button>
      </div>}
    </section>

    {step<6 && <nav className="actions">{step>0?<button className="back" onClick={back}>Voltar</button>:<span/>}<button className="next" onClick={next}>{step===0?"Começar":"Próximo"} <span>→</span></button></nav>}
    {step===6 && <button className="floatingBack" onClick={back}>← Voltar</button>}
    <footer>Ferramenta educativa · Resolução CONAMA 418/2009</footer>
  </main>;
}
