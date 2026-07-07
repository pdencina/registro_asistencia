import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { LogIn, LogOut, XCircle, Loader, Scan, Fingerprint } from 'lucide-react';
import { employeesApi, attendanceApi } from '../api';
import { playSuccess, playError, playRecognized } from '../utils/sounds';

// Estados del flujo
const STEP_HOME = 'home';
const STEP_SCANNING = 'scanning';
const STEP_RECOGNIZED = 'recognized';
const STEP_CONFIRMED = 'confirmed';
const STEP_ERROR = 'error';

export default function CheckInPage() {
  const [step, setStep] = useState(STEP_HOME);
  const [employees, setEmployees] = useState([]);
  const [recognizedEmployee, setRecognizedEmployee] = useState(null);
  const [employeeStatus, setEmployeeStatus] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadError, setModelLoadError] = useState('');
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [loadingDescriptors, setLoadingDescriptors] = useState(false);

  const webcamRef = useRef(null);
  const detectionInterval = useRef(null);

  // Load face-api models on mount
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
    if (modelsLoaded) loadEmployeesAndDescriptors();
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
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.5));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDescriptors(false);
    }
  }

  // Detection loop — only when scanning
  useEffect(() => {
    if (step === STEP_SCANNING && modelsLoaded && faceMatcher) {
      startDetection();
    }
    return () => stopDetection();
  }, [step, modelsLoaded, faceMatcher]);

  // Timeout: volver al home si no detecta rostro en 30 segundos
  useEffect(() => {
    if (step === STEP_SCANNING) {
      const timeout = setTimeout(() => {
        resetFlow();
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  function startDetection() {
    if (detectionInterval.current) return;
    detectionInterval.current = setInterval(detectFace, 1500);
  }

  function stopDetection() {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
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
            playRecognized();
            // Get status
            try {
              const status = await attendanceApi.getEmployeeStatus(employee.id);
              setEmployeeStatus(status);
            } catch (e) {
              setEmployeeStatus(null);
            }
            setStep(STEP_RECOGNIZED);
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
    setErrorMsg('');

    try {
      // Validación: verificar si ya tiene registro de este tipo hoy
      const today = new Date().toISOString().split('T')[0];
      const history = await attendanceApi.getHistory({
        employee_id: recognizedEmployee.id,
        start_date: today,
        end_date: today,
        type: type,
      });

      if (history.length > 0) {
        const hora = new Date(history[0].timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setErrorMsg(
          type === 'entry'
            ? `Ya registraste tu ingreso hoy a las ${hora} hrs`
            : `Ya registraste tu salida hoy a las ${hora} hrs`
        );
        setLoading(false);
        return;
      }

      // Si es salida, validar que tenga ingreso primero
      if (type === 'exit') {
        const entries = await attendanceApi.getHistory({
          employee_id: recognizedEmployee.id,
          start_date: today,
          end_date: today,
          type: 'entry',
        });
        if (entries.length === 0) {
          setErrorMsg('Debes registrar tu ingreso antes de marcar salida');
          setLoading(false);
          return;
        }
      }

      let photo_snapshot = null;
      if (webcamRef.current) {
        photo_snapshot = webcamRef.current.getScreenshot();
      }

      await attendanceApi.register({
        employee_id: recognizedEmployee.id,
        type,
        photo_snapshot,
      });

      // Get summary for confirmation screen
      let todayEntry = null;
      let todayExit = null;
      try {
        const allToday = await attendanceApi.getHistory({
          employee_id: recognizedEmployee.id,
          start_date: today,
          end_date: today,
        });
        const entry = allToday.find(r => r.type === 'entry');
        const exit = allToday.find(r => r.type === 'exit');
        if (entry) todayEntry = new Date(entry.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        if (exit) todayExit = new Date(exit.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}

      setConfirmData({
        actionType: type,
        employee: `${recognizedEmployee.first_name} ${recognizedEmployee.last_name}`,
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        todayEntry,
        todayExit,
      });

      playSuccess();
      setStep(STEP_CONFIRMED);

      // Volver al home después de 6 segundos
      setTimeout(() => {
        resetFlow();
      }, 6000);
    } catch (err) {
      setErrorMsg(err.message);
      playError();
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep(STEP_HOME);
    setRecognizedEmployee(null);
    setEmployeeStatus(null);
    setConfirmData(null);
    setErrorMsg('');
  }

  function startScanning() {
    setStep(STEP_SCANNING);
  }

  function cancelRecognition() {
    resetFlow();
  }

  // Auto-return to home if employee already completed their day
  useEffect(() => {
    if (step === STEP_RECOGNIZED && employeeStatus?.status === 'exited') {
      const timer = setTimeout(() => resetFlow(), 3000);
      return () => clearTimeout(timer);
    }
  }, [step, employeeStatus]);

  // Timeout: volver al home si no interactúa en 15 segundos
  useEffect(() => {
    if (step === STEP_RECOGNIZED && employeeStatus?.status !== 'exited') {
      const timeout = setTimeout(() => resetFlow(), 15000);
      return () => clearTimeout(timeout);
    }
  }, [step, employeeStatus]);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  // ═══════════════════════════════════════════════════════════
  // STEP: HOME — Pantalla de bienvenida
  // ═══════════════════════════════════════════════════════════
  if (step === STEP_HOME) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-fade-in">
        <div className="text-center max-w-md">
          <div className="w-28 h-28 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Fingerprint className="w-16 h-16 text-primary-600" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-3">Registra tu asistencia</h2>
          <p className="text-lg text-gray-500 mb-10">
            Presiona el botón y acércate a la cámara para identificarte
          </p>

          {modelsLoaded && faceMatcher ? (
            <button
              onClick={startScanning}
              className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl
                         font-bold text-xl shadow-xl shadow-primary-200 transition-all active:scale-95
                         flex items-center justify-center gap-3"
            >
              <Scan className="w-7 h-7" />
              Iniciar Reconocimiento
            </button>
          ) : modelsLoaded && !faceMatcher && !loadingDescriptors ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="text-amber-700 font-medium">⚠️ No hay empleados con foto registrada</p>
              <p className="text-amber-600 text-sm mt-1">Contacta al administrador</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-10 h-10 text-primary-500 animate-spin" />
              <p className="text-gray-500">
                {!modelsLoaded ? 'Cargando sistema...' : 'Preparando reconocimiento...'}
              </p>
            </div>
          )}

          {modelLoadError && (
            <div className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-200">
              <p className="text-red-700">{modelLoadError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STEP: SCANNING — Cámara activa buscando rostro
  // ═══════════════════════════════════════════════════════════
  if (step === STEP_SCANNING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-fade-in">
        <div className="w-full max-w-xl">
          {/* Instruction */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              Buscando tu rostro...
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

            {/* Corner guides */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-6 left-6 w-16 h-16 border-t-4 border-l-4 border-white/70 rounded-tl-xl" />
              <div className="absolute top-6 right-6 w-16 h-16 border-t-4 border-r-4 border-white/70 rounded-tr-xl" />
              <div className="absolute bottom-6 left-6 w-16 h-16 border-b-4 border-l-4 border-white/70 rounded-bl-xl" />
              <div className="absolute bottom-6 right-6 w-16 h-16 border-b-4 border-r-4 border-white/70 rounded-br-xl" />
            </div>

            <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              EN VIVO
            </div>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-full text-base font-medium">
              📷 Acércate a la cámara
            </div>
          </div>

          <button onClick={cancelRecognition} className="w-full mt-5 py-3 text-gray-400 hover:text-gray-600 text-sm">
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // STEP: RECOGNIZED — Empleado reconocido, elige acción
  // ═══════════════════════════════════════════════════════════
  if (step === STEP_RECOGNIZED && recognizedEmployee) {
    // Determinar qué botones mostrar según el status
    const alreadyEntry = employeeStatus?.status === 'present' || employeeStatus?.status === 'exited';
    const alreadyExit = employeeStatus?.status === 'exited';

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-fade-in">
        {/* Webcam oculta para snapshot */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="hidden"
          mirrored={true}
        />

        <div className="w-full max-w-md">
          {/* Saludo */}
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

            {/* Status info */}
            {employeeStatus?.status === 'present' && employeeStatus.last_record && (
              <p className="text-sm text-emerald-600 mt-3 bg-emerald-50 inline-block px-3 py-1.5 rounded-full">
                ✓ Ingresaste hoy a las {new Date(employeeStatus.last_record.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
              </p>
            )}
            {employeeStatus?.status === 'exited' && (
              <p className="text-sm text-orange-600 mt-3 bg-orange-50 inline-block px-3 py-1.5 rounded-full">
                ✓ Ya completaste tu jornada hoy — volviendo al inicio...
              </p>
            )}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
              <p className="text-red-700 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Botones */}
          <div className="grid grid-cols-2 gap-5 mb-8">
            <button
              onClick={() => handleRegister('entry')}
              disabled={loading || alreadyEntry}
              className={`flex flex-col items-center justify-center gap-4 py-12 rounded-3xl
                         font-bold text-xl transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100
                         ${alreadyEntry 
                           ? 'bg-gray-200 text-gray-400 border-4 border-gray-200 shadow-none cursor-not-allowed' 
                           : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-200 border-4 border-emerald-400'
                         }`}
            >
              <LogIn className="w-14 h-14" />
              <span>INGRESO</span>
              {alreadyEntry && <span className="text-xs font-normal">Ya registrado</span>}
            </button>

            <button
              onClick={() => handleRegister('exit')}
              disabled={loading || alreadyExit || !alreadyEntry}
              className={`flex flex-col items-center justify-center gap-4 py-12 rounded-3xl
                         font-bold text-xl transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100
                         ${alreadyExit || !alreadyEntry
                           ? 'bg-gray-200 text-gray-400 border-4 border-gray-200 shadow-none cursor-not-allowed' 
                           : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-200 border-4 border-orange-400'
                         }`}
            >
              <LogOut className="w-14 h-14" />
              <span>SALIDA</span>
              {alreadyExit && <span className="text-xs font-normal">Ya registrado</span>}
              {!alreadyEntry && !alreadyExit && <span className="text-xs font-normal">Primero ingresa</span>}
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
  // STEP: CONFIRMED — Registro exitoso
  // ═══════════════════════════════════════════════════════════
  if (step === STEP_CONFIRMED && confirmData) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 animate-fade-in">
        <div className="w-full max-w-md p-10 rounded-3xl text-center bg-white border-2 border-emerald-200 shadow-xl">
          <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
            confirmData.actionType === 'entry' ? 'bg-emerald-100' : 'bg-orange-100'
          }`}>
            {confirmData.actionType === 'entry' ? (
              <LogIn className="w-14 h-14 text-emerald-600" />
            ) : (
              <LogOut className="w-14 h-14 text-orange-600" />
            )}
          </div>

          <p className={`text-3xl font-bold mb-2 ${
            confirmData.actionType === 'entry' ? 'text-emerald-700' : 'text-orange-700'
          }`}>
            {confirmData.actionType === 'entry' ? '¡Ingreso Registrado!' : '¡Salida Registrada!'}
          </p>

          <p className="text-xl text-gray-700 mb-4">{confirmData.employee}</p>

          {/* Resumen del día */}
          <div className="bg-gray-50 rounded-2xl p-4 mt-4 space-y-2">
            {confirmData.actionType === 'entry' ? (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <LogIn className="w-5 h-5 text-emerald-500" />
                <span>Tu ingreso hoy: <strong>{confirmData.time} hrs</strong></span>
              </div>
            ) : (
              <>
                {confirmData.todayEntry && (
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <LogIn className="w-5 h-5 text-emerald-500" />
                    <span>Ingreso: <strong>{confirmData.todayEntry} hrs</strong></span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <LogOut className="w-5 h-5 text-orange-500" />
                  <span>Salida: <strong>{confirmData.time} hrs</strong></span>
                </div>
                {confirmData.todayEntry && (
                  <p className="text-sm text-gray-400 mt-2 pt-2 border-t border-gray-200">
                    ¡Buen trabajo hoy! 🙌
                  </p>
                )}
              </>
            )}
          </div>

          <p className="text-sm text-gray-400 mt-6">Volviendo al inicio...</p>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
