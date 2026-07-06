import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { LogIn, LogOut, CheckCircle, XCircle, Loader, Scan } from 'lucide-react';
import { employeesApi, attendanceApi } from '../api';

export default function CheckInPage() {
  const [employees, setEmployees] = useState([]);
  const [recognizedEmployee, setRecognizedEmployee] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadError, setModelLoadError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [loadingDescriptors, setLoadingDescriptors] = useState(false);

  const webcamRef = useRef(null);
  const detectionInterval = useRef(null);

  // Load face-api models
  useEffect(() => {
    async function loadModels() {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error('Error loading models:', err);
        setModelLoadError('Error cargando modelos de reconocimiento facial');
      }
    }
    loadModels();
  }, []);

  // Load employees and build face descriptors
  useEffect(() => {
    if (modelsLoaded) {
      loadEmployeesAndDescriptors();
    }
  }, [modelsLoaded]);

  async function loadEmployeesAndDescriptors() {
    setLoadingDescriptors(true);
    try {
      const data = await employeesApi.getAll({ active: '1' });
      setEmployees(data);

      const labeledDescriptors = [];
      for (const emp of data) {
        if (!emp.photo_url) continue;
        try {
          const img = await faceapi.fetchImage(emp.photo_url);
          const detection = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) {
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(emp.id, [detection.descriptor])
            );
          }
        } catch (err) {
          console.warn(`No se pudo procesar foto de ${emp.first_name}:`, err.message);
        }
      }

      if (labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
        setFaceMatcher(matcher);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDescriptors(false);
    }
  }

  // Start face detection loop
  useEffect(() => {
    if (modelsLoaded && faceMatcher && !recognizedEmployee && !message) {
      startDetection();
    }
    return () => stopDetection();
  }, [modelsLoaded, faceMatcher, recognizedEmployee, message]);

  function startDetection() {
    if (detectionInterval.current) return;
    setDetecting(true);
    detectionInterval.current = setInterval(detectFace, 1500);
  }

  function stopDetection() {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    setDetecting(false);
  }

  async function detectFace() {
    if (!webcamRef.current || !webcamRef.current.video || !faceMatcher) return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    try {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const match = faceMatcher.findBestMatch(detection.descriptor);
        if (match.label !== 'unknown') {
          const employee = employees.find(e => e.id === match.label);
          if (employee) {
            stopDetection();
            setRecognizedEmployee(employee);
          }
        }
      }
    } catch (err) {
      // Silent fail
    }
  }

  async function handleRegister(type) {
    if (!recognizedEmployee) return;
    setLoading(true);
    try {
      let photo_snapshot = null;
      if (webcamRef.current) {
        photo_snapshot = webcamRef.current.getScreenshot();
      }

      await attendanceApi.register({
        employee_id: recognizedEmployee.id,
        type,
        photo_snapshot,
      });

      setMessage({
        type: 'success',
        actionType: type,
        employee: `${recognizedEmployee.first_name} ${recognizedEmployee.last_name}`,
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      });

      setRecognizedEmployee(null);
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  function cancelRecognition() {
    setRecognizedEmployee(null);
  }

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  // ═══════════════════════════════════════════════════════════
  // VISTA 1: Mensaje de confirmación (después de registrar)
  // ═══════════════════════════════════════════════════════════
  if (message) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className={`w-full max-w-md p-10 rounded-3xl text-center animate-fade-in ${
          message.type === 'success'
            ? 'bg-white border-2 border-emerald-200 shadow-xl'
            : 'bg-white border-2 border-red-200 shadow-xl'
        }`}>
          {message.type === 'success' ? (
            <>
              <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
                message.actionType === 'entry' ? 'bg-emerald-100' : 'bg-orange-100'
              }`}>
                {message.actionType === 'entry' ? (
                  <CheckCircle className="w-14 h-14 text-emerald-600" />
                ) : (
                  <LogOut className="w-14 h-14 text-orange-600" />
                )}
              </div>
              <p className={`text-3xl font-bold mb-3 ${
                message.actionType === 'entry' ? 'text-emerald-700' : 'text-orange-700'
              }`}>
                {message.actionType === 'entry' ? '¡Ingreso Registrado!' : '¡Salida Registrada!'}
              </p>
              <p className="text-xl text-gray-700 mb-2">{message.employee}</p>
              <p className="text-lg text-gray-400">{message.time} hrs</p>
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <p className="text-2xl font-bold text-red-700 mb-2">Error</p>
              <p className="text-gray-600">{message.text}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VISTA 2: Empleado reconocido → elige INGRESO o SALIDA
  // ═══════════════════════════════════════════════════════════
  if (recognizedEmployee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        {/* Webcam oculta para snapshot */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="hidden"
          mirrored={true}
        />

        <div className="w-full max-w-md animate-fade-in">
          {/* Saludo personalizado */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden mx-auto mb-4 ring-4 ring-emerald-200">
              {recognizedEmployee.photo_url ? (
                <img src={recognizedEmployee.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl">
                  {recognizedEmployee.first_name[0]}{recognizedEmployee.last_name[0]}
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              Hola, {recognizedEmployee.first_name} 👋
            </p>
            <p className="text-gray-500">¿Qué deseas registrar?</p>
          </div>

          {/* Botones INGRESO / SALIDA */}
          <div className="grid grid-cols-2 gap-5 mb-8">
            <button
              onClick={() => handleRegister('entry')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-4 py-12 rounded-3xl
                         bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl
                         shadow-xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50
                         border-4 border-emerald-400"
            >
              <LogIn className="w-14 h-14" />
              <span>INGRESO</span>
            </button>

            <button
              onClick={() => handleRegister('exit')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-4 py-12 rounded-3xl
                         bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl
                         shadow-xl shadow-orange-200 transition-all active:scale-95 disabled:opacity-50
                         border-4 border-orange-400"
            >
              <LogOut className="w-14 h-14" />
              <span>SALIDA</span>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-4">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Registrando...</span>
            </div>
          )}

          <button onClick={cancelRecognition} className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm">
            No soy esta persona
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VISTA 3: Cámara activa buscando rostro
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="w-full max-w-xl">

        {modelLoadError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-center">
            <p className="text-red-800 font-semibold">{modelLoadError}</p>
          </div>
        )}

        {/* Loading state */}
        {!modelsLoaded && !modelLoadError && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Loader className="w-16 h-16 text-primary-500 animate-spin mb-6" />
            <p className="text-gray-600 text-xl font-medium">Preparando sistema...</p>
            <p className="text-gray-400 mt-2">Esto toma unos segundos</p>
          </div>
        )}

        {/* Camera active */}
        {modelsLoaded && (
          <>
            {/* Instruction */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                {loadingDescriptors ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Preparando reconocimiento...</>
                ) : detecting ? (
                  <><Scan className="w-4 h-4" /> Míra la cámara para identificarte</>
                ) : (
                  <><Loader className="w-4 h-4 animate-spin" /> Iniciando...</>
                )}
              </div>
            </div>

            {/* Camera */}
            <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full aspect-[4/3] object-cover"
                mirrored={true}
              />

              {/* Overlay frame */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner guides */}
                <div className="absolute top-6 left-6 w-16 h-16 border-t-4 border-l-4 border-white/70 rounded-tl-xl" />
                <div className="absolute top-6 right-6 w-16 h-16 border-t-4 border-r-4 border-white/70 rounded-tr-xl" />
                <div className="absolute bottom-6 left-6 w-16 h-16 border-b-4 border-l-4 border-white/70 rounded-bl-xl" />
                <div className="absolute bottom-6 right-6 w-16 h-16 border-b-4 border-r-4 border-white/70 rounded-br-xl" />
              </div>

              {/* Live indicator */}
              <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                EN VIVO
              </div>

              {/* Bottom message */}
              {faceMatcher && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-full text-base font-medium">
                  📷 Acércate a la cámara
                </div>
              )}
              {!faceMatcher && !loadingDescriptors && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-6 py-3 rounded-full text-base">
                  ⚠️ No hay empleados con foto registrada
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
