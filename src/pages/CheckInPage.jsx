import { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Camera, LogIn, LogOut, CheckCircle, XCircle, Loader, UserCheck } from 'lucide-react';
import { employeesApi, attendanceApi } from '../api';

export default function CheckInPage() {
  const [employees, setEmployees] = useState([]);
  const [recognizedEmployee, setRecognizedEmployee] = useState(null);
  const [employeeStatus, setEmployeeStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadError, setModelLoadError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [loadingDescriptors, setLoadingDescriptors] = useState(false);

  const webcamRef = useRef(null);
  const detectionInterval = useRef(null);
  const canvasRef = useRef(null);

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

      // Build face descriptors from employee photos
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
    if (modelsLoaded && faceMatcher && !recognizedEmployee) {
      startDetection();
    }
    return () => stopDetection();
  }, [modelsLoaded, faceMatcher, recognizedEmployee]);

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

            // Get employee status
            const status = await attendanceApi.getEmployeeStatus(employee.id);
            setEmployeeStatus(status);
          }
        }
      }
    } catch (err) {
      // Silent fail on detection errors
    }
  }

  const captureAndRegister = useCallback(async () => {
    if (!webcamRef.current || !recognizedEmployee || !employeeStatus) return;

    setLoading(true);
    try {
      const photo_snapshot = webcamRef.current.getScreenshot();

      await attendanceApi.register({
        employee_id: recognizedEmployee.id,
        type: employeeStatus.next_action,
        photo_snapshot,
      });

      setMessage({
        type: 'success',
        text: `${employeeStatus.next_action === 'entry' ? 'Entrada' : 'Salida'} registrada para ${recognizedEmployee.first_name} ${recognizedEmployee.last_name}`,
        time: new Date().toLocaleTimeString('es-CL'),
      });

      setTimeout(() => {
        setRecognizedEmployee(null);
        setEmployeeStatus(null);
        setMessage(null);
      }, 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [recognizedEmployee, employeeStatus]);

  // Auto-register after recognition with a short delay
  useEffect(() => {
    if (recognizedEmployee && employeeStatus && !loading && !message) {
      const timer = setTimeout(() => {
        captureAndRegister();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [recognizedEmployee, employeeStatus, loading, message, captureAndRegister]);

  function cancelRecognition() {
    setRecognizedEmployee(null);
    setEmployeeStatus(null);
  }

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {message && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-50 border-2 border-emerald-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 shrink-0" />
          )}
          <div>
            <p className={`font-semibold text-lg ${
              message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}>{message.text}</p>
            {message.time && <p className="text-sm text-gray-500">Hora: {message.time}</p>}
          </div>
        </div>
      )}

      {modelLoadError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-200">
          <p className="text-red-800 font-semibold">{modelLoadError}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Registro Facial Automático</h2>
          <div className="flex items-center gap-2">
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
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Buscando rostro...
              </span>
            )}
          </div>
        </div>

        {/* Recognized employee info */}
        {recognizedEmployee && (
          <div className="flex items-center gap-3 mb-4 p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
            <UserCheck className="w-8 h-8 text-emerald-600" />
            <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {recognizedEmployee.photo_url ? (
                <img src={recognizedEmployee.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                  {recognizedEmployee.first_name[0]}{recognizedEmployee.last_name[0]}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-lg">
                {recognizedEmployee.first_name} {recognizedEmployee.last_name}
              </p>
              <p className="text-sm text-gray-500">{recognizedEmployee.department || 'Sin área'}</p>
            </div>
            {employeeStatus && (
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                employeeStatus.status === 'present'
                  ? 'bg-emerald-100 text-emerald-700'
                  : employeeStatus.status === 'exited'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {employeeStatus.status === 'present' ? 'En oficina' :
                 employeeStatus.status === 'exited' ? 'Salió' : 'No ha ingresado'}
              </span>
            )}
            <button onClick={cancelRecognition} className="text-gray-400 hover:text-gray-600 text-sm">
              ✕
            </button>
          </div>
        )}

        {/* Camera */}
        <div className="relative rounded-2xl overflow-hidden bg-black mb-4 aspect-[4/3]">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={true}
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
          <div className="absolute inset-0 border-4 border-white/30 rounded-2xl pointer-events-none" />
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            EN VIVO
          </div>
          {!recognizedEmployee && faceMatcher && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
              Acércate a la cámara para identificarte
            </div>
          )}
          {!faceMatcher && modelsLoaded && !loadingDescriptors && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-sm px-4 py-2 rounded-full">
              No hay empleados con foto registrada
            </div>
          )}
        </div>

        {/* Register button */}
        {recognizedEmployee && employeeStatus && (
          <div className="space-y-3">
            <button
              onClick={captureAndRegister}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 
                transition-all active:scale-95 disabled:opacity-50 ${
                employeeStatus.next_action === 'entry'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200'
              }`}
            >
              {employeeStatus.next_action === 'entry' ? (
                <><LogIn className="w-6 h-6" />{loading ? 'Registrando...' : 'Registrando ENTRADA en 2s...'}</>
              ) : (
                <><LogOut className="w-6 h-6" />{loading ? 'Registrando...' : 'Registrando SALIDA en 2s...'}</>
              )}
            </button>
            <button onClick={cancelRecognition} className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">
              ✕ No soy esta persona — cancelar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!modelsLoaded && !modelLoadError && (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Loader className="w-12 h-12 text-primary-500 animate-spin mb-4" />
            <p className="text-gray-500 text-lg">Cargando sistema de reconocimiento facial...</p>
            <p className="text-gray-400 text-sm mt-2">Esto puede tomar unos segundos la primera vez</p>
          </div>
        )}
      </div>
    </div>
  );
}
