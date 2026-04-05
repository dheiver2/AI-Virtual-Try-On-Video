/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Video, 
  Sparkles, 
  Loader2, 
  Play, 
  AlertCircle, 
  Key, 
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type GarmentCategory = 'upper_body' | 'lower_body' | 'dresses';

const GARMENT_OPTIONS: Array<{ value: GarmentCategory; label: string; help: string }> = [
  { value: 'upper_body', label: 'Parte de cima', help: 'camiseta, blusa, casaco' },
  { value: 'lower_body', label: 'Parte de baixo', help: 'calca, saia, short' },
  { value: 'dresses', label: 'Vestido', help: 'peca unica' },
];

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [clothingImage, setClothingImage] = useState<string | null>(null);
  const [referenceVideo, setReferenceVideo] = useState<string | null>(null);
  const [referenceVideoData, setReferenceVideoData] = useState<string | null>(null);
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>('upper_body');
  const [prompt, setPrompt] = useState('Manter o movimento original e trocar somente a roupa principal pela peca enviada, com caimento realista.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasApiKey(true);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setClothingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setReferenceVideo(url);
    const reader = new FileReader();
    reader.onloadend = () => setReferenceVideoData(reader.result as string);
    reader.readAsDataURL(file);
    setVideoUrl(null);
    setError(null);

    // Extract the first frame preserving the original aspect ratio.
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);

      const extractFrame = (time: number, callback: (data: string) => void) => {
        const tempVideo = document.createElement('video');
        tempVideo.src = url;
        tempVideo.crossOrigin = 'anonymous';
        tempVideo.preload = 'auto';
        tempVideo.muted = true;
        tempVideo.onloadedmetadata = () => {
          tempVideo.currentTime = Math.min(time, Math.max(tempVideo.duration - 0.05, 0));
        };
        tempVideo.onseeked = () => {
          const maxDimension = 1280;
          const scale = Math.min(1, maxDimension / Math.max(tempVideo.videoWidth, tempVideo.videoHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(tempVideo.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(tempVideo.videoHeight * scale));
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.95));
          }
        };
      };

      extractFrame(0.1, setVideoFrame);
    };
  };

  const generateVideo = async () => {
    if (!clothingImage || !videoFrame || !referenceVideoData) {
      setError('Por favor, envie a imagem da roupa e o vídeo de referência.');
      return;
    }
    if (videoDuration !== null && videoDuration < 2) {
      setError('Use um video com pelo menos 2 segundos para o modelo ter movimento suficiente.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setGenerationStatus('Preparando o frame de referencia da roupa...');

    try {
      setGenerationStatus('Gerando o look-base com try-on de alta fidelidade...');

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          garmentImage: clothingImage,
          garmentCategory,
          sourceVideo: referenceVideoData,
          sourceVideoDuration: videoDuration,
          firstFrame: videoFrame,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Falha na inferência (${response.status}): ${errText}`);
      }

      const blob = await response.blob();
      if (!blob.type.includes('video')) {
        const text = await blob.text();
        throw new Error(`Resposta inválida do servidor: ${text || 'não retornou vídeo.'}`);
      }
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setGenerationStatus('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro inesperado.');
      if (
        err.message?.includes('REPLICATE_API_TOKEN') ||
        err.message?.includes('Configure') ||
        err.message?.includes('token')
      ) setHasApiKey(false);
    } finally {
      setIsGenerating(false);
    }
  };

  if (showLanding) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
        {/* Hero Section */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse delay-700" />
          
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-100">Crie sua Influencer Digital</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent leading-tight"
            >
              Sua Marca na <br /> Influencer Ideal
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              Venda muito mais com influencers digitais personalizadas. Troque o look de qualquer vídeo instantaneamente e coloque sua marca em destaque.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button
                onClick={() => setShowLanding(false)}
                className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all flex items-center gap-2 group shadow-xl shadow-white/10"
              >
                Começar Agora
                <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#como-funciona"
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                Saiba Mais
              </a>
            </motion.div>
          </div>
          
          {/* Floating Elements */}
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 right-[10%] hidden lg:block"
          >
            <div className="w-24 h-32 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-4 flex flex-col items-center justify-center gap-2">
              <ImageIcon className="w-8 h-8 text-blue-400" />
              <div className="w-full h-1 bg-blue-400/20 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-blue-400" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/4 left-[10%] hidden lg:block"
          >
            <div className="w-32 h-24 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm p-4 flex flex-col items-center justify-center gap-2">
              <Video className="w-8 h-8 text-purple-400" />
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="como-funciona" className="py-32 px-6 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Potencialize sua Marca</h2>
              <p className="text-gray-400 max-w-xl mx-auto">Crie conteúdo de alta conversão com influencers digitais em segundos.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Upload className="w-8 h-8 text-blue-400" />,
                  title: "Sua Coleção",
                  desc: "Suba as fotos dos produtos da sua marca que você quer que a influencer use."
                },
                {
                  icon: <Video className="w-8 h-8 text-purple-400" />,
                  title: "Escolha a Influencer",
                  desc: "Use vídeos de modelos ou influencers virtuais como base para sua campanha."
                },
                {
                  icon: <Sparkles className="w-8 h-8 text-green-400" />,
                  title: "Venda Mais",
                  desc: "Gere vídeos realistas que conectam sua marca ao público e aumentam suas vendas."
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -10 }}
                  className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-600/10 blur-[150px] rounded-full translate-y-1/2" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">Domine o mercado com Influencers Digitais</h2>
            <button
              onClick={() => setShowLanding(false)}
              className="px-12 py-6 bg-white text-black font-bold text-xl rounded-2xl hover:scale-105 transition-all shadow-2xl shadow-white/20"
            >
              Criar minha Campanha Agora
            </button>
          </div>
        </section>

        <footer className="py-12 px-6 border-t border-white/5 text-center text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white">AI Virtual Try-On</span>
          </div>
          <p>© 2026 Todos os direitos reservados. Criado com modelo open source de vídeo.</p>
        </footer>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
        >
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Configure a API Replicate</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            1. Acesse <a href="https://replicate.com/account/api-tokens" target="_blank" className="text-blue-400 underline">https://replicate.com/account/api-tokens</a><br/>
            2. Copie seu token de API<br/>
            3. Cole em `.env.local`: `REPLICATE_API_TOKEN=seu_token`
          </p>
          <p className="mt-6 text-xs text-gray-500">
            Usamos a API gratuita do Replicate para virtual try-on de alta qualidade, sem custo inicial.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Influencer Brand Manager</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowLanding(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white mr-2"
              title="Voltar para Início"
            >
              <Play className="w-5 h-5 rotate-180" />
            </button>
            <button 
                      onClick={() => {
                        setClothingImage(null);
                        setReferenceVideo(null);
                        setReferenceVideoData(null);
                        setVideoFrame(null);
                        setVideoDuration(null);
                        setVideoUrl(null);
                        setError(null);
                      }}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Resetar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Column: Controls */}
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Entradas de Mídia
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Clothing Upload */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`aspect-square rounded-3xl border-2 border-dashed transition-all cursor-pointer group relative overflow-hidden ${
                    clothingImage ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
                  {clothingImage ? (
                    <>
                      <img src={clothingImage} alt="Clothing" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-8 h-8" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      <Upload className="w-8 h-8 mb-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      <span className="text-sm font-medium text-gray-400">Look da Marca</span>
                    </div>
                  )}
                </div>

                {/* Video Upload */}
                <div 
                  onClick={() => videoInputRef.current?.click()}
                  className={`aspect-square rounded-3xl border-2 border-dashed transition-all cursor-pointer group relative overflow-hidden ${
                    referenceVideo ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={videoInputRef} 
                    className="hidden" 
                    accept="video/*" 
                    onChange={handleVideoUpload} 
                  />
                  {referenceVideo ? (
                    <>
                      <video src={referenceVideo} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Video className="w-8 h-8" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      <Video className="w-8 h-8 mb-3 text-gray-500 group-hover:text-purple-400 transition-colors" />
                      <span className="text-sm font-medium text-gray-400">Vídeo da Influencer</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Configuracao do Try-On
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Tipo da peca</label>
                  <select
                    value={garmentCategory}
                    onChange={(e) => setGarmentCategory(e.target.value as GarmentCategory)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  >
                    {GARMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#111]">
                        {option.label} - {option.help}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex.: manter rosto, cabelo, cenario e movimento originais; aplicar exatamente a roupa enviada sem trocar o estilo do video."
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
                />

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                  O novo pipeline funciona melhor com uma foto da roupa bem recortada. Se o video passar de 10 segundos, ele sera dividido automaticamente em trechos curtos e depois unido no final.
                  {videoDuration !== null && (
                    <span className={`block mt-2 font-medium ${videoDuration >= 2 ? 'text-green-400' : 'text-amber-400'}`}>
                      Duracao detectada: {videoDuration.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            </section>

            <button
              onClick={generateVideo}
              disabled={isGenerating || !clothingImage || !referenceVideo}
              className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-xl ${
                isGenerating || !clothingImage || !referenceVideo
                  ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Gerando Video...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  Criar Video com Troca de Roupa
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="relative">
            <div className="sticky top-32">
              <div className="aspect-[16/9] bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative group">
                <AnimatePresence mode="wait">
                  {videoUrl ? (
                    <motion.video
                      key="video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={videoUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-cover"
                    />
                  ) : isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                    >
                      <div className="relative mb-8">
                        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <Sparkles className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Processando Video...</h3>
                      <p className="text-gray-400 max-w-xs leading-relaxed">
                        {generationStatus || 'Estamos editando o video original para manter movimento, rosto e cenario.'}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-gray-500"
                    >
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                        <Video className="w-10 h-10" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Resultado Final</h3>
                      <p className="max-w-xs">O video final com a roupa aplicada no movimento original aparecera aqui.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status Indicators */}
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-2xl border transition-all ${clothingImage ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                  <CheckCircle2 className={`w-5 h-5 mb-2 ${clothingImage ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Marca</span>
                </div>
                <div className={`p-4 rounded-2xl border transition-all ${referenceVideo ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                  <CheckCircle2 className={`w-5 h-5 mb-2 ${referenceVideo ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Influencer</span>
                </div>
                <div className={`p-4 rounded-2xl border transition-all ${videoUrl ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                  <CheckCircle2 className={`w-5 h-5 mb-2 ${videoUrl ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Saída</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 text-center text-gray-500 text-sm">
        <p>© 2026 AI Virtual Try-On. Powered by open source video model.</p>
      </footer>
    </div>
  );
}
