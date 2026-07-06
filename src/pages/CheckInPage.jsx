import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { LogIn, LogOut, CheckCircle, XCircle, Loader, UserCheck } from 'lucide-react';
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
        text: `${type === 'entry' ? 'Ingreso' : 'Salida'} registrado`,
        employee: `${recognizedEmployee.first_name} ${recognizedEmployee.last_name}`,
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      });

      setRecognizedEmployee(null);

      setTimeout(() => {
        setMessage(null);
      }, 5000);
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

  // ─── VISTA: Mensaje de éxito/error ───
  if (message) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className={`w-full max-w-lg p-8 rounded-3xl text-center ${
          message.type === 'success'
            ? 'bg-emerald-50 border-2 border-emerald-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          )}
          <p className={`text-3xl font-bold mb-2 ${
            message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
          }`}>{message.text}</p>
          {message.employee && (
            <p className="text-xl text-gray-700 mb-1">{message.employee}</p>
          )}
          {message.time && (
            <p className="text-lg text-gray-500">{message.time}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── VISTA: Empleado reconocido → elegir INGRESO o SALIDA ───
  if (recognizedEmployee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        {/* Webcam oculta para tomar snapshot */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="hidden"
          mirrored={true}
        />
        <div className="w-full max-w-lg">
          {/* Identidad reconocida */}
          <div className="flex items-center gap-4 mb-8 p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
            <UserCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {recognizedEmployee.photo_url ? (
                <img src={recognizedEmployee.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xl">
                  {recognizedEmployee.first_name[0]}{recognizedEmployee.last_name[0]}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-xl">
                {recognizedEmployee.first_name} {recognizedEmployee.last_name}
              </p>
              <p className="text-sm text-gray-500">{recognizedEmployee.department || 'Sin área'}</p>
            </div>
          </div>

          {/* Botones INGRESO / SALIDA */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => handleRegister('entry')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl
                         bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xl
                         shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-12 h-12" />
              INGRESO
            </button>

            <button
              onClick={() => handleRegister('exit')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl
                         bg-orange-600 hover:bg-orange-700 text-white font-bold text-xl
                         shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <LogOut className="w-12 h-12" />
              SALIDA
            </button>
          </div>

          <button onClick={cancelRecognition} className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium">
            ✕ No soy esta persona
          </button>
        </div>
      </div>
    );
  }

  // ─── VISTA: Cámara buscando rostro ───
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="w-full max-w-2xl">
        {modelLoadError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-200">
            <p className="text-red-800 font-semibold">{modelLoadError}</p>
          </div>
        )}

        {/* Status indicators */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {!modelsLoaded && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <Loader className="w-4 h-4 animate-spin" /> Cargando modelos...
            </span>
          )}
          {loadingDescriptors && (
            <span className="text-sm text-blue-600 flex items-center gap-1">
              <Loader className="w-4 h-4 animate-spin" /> Procesando rostros...
            </span>
          )}
          {detecting && (
            <span className="text-sm text-emerald-600 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Reconocimiento activo
            </span>
          )}
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
          <div className="absolute inset-0 border-4 border-white/20 rounded-3xl pointer-events-none" />
          <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            EN VIVO
          </div>
          {faceMatcher && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-6 py-3 rounded-full text-base">
              Acércate para identificarte
            </div>
          )}
          {!faceMatcher && modelsLoaded && !loadingDescriptors && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-6 py-3 rounded-full text-base">
              No hay empleados con foto registrada
            </div>
          )}
        </div>

        {/* Loading models state */}
        {!modelsLoaded && !modelLoadError && (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Loader className="w-12 h-12 text-primary-500 animate-spin mb-4" />
            <p className="text-gray-500 text-lg">Cargando reconocimiento facial...</p>
          </div>
        )}
      </div>
    </div>
  );
}
