const DB_NAME = 'emotion-planet-audio'
const STORE_NAME = 'recordings'
const DB_VERSION = 1

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开录音存储'))
  })
}

export function isAudioSupported() {
  return typeof window !== 'undefined' && Boolean(window.MediaRecorder)
}

export async function saveAudio(id, blob, meta = {}) {
  if (!blob) return null
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const record = {
      id,
      blob,
      mimeType: blob.type || meta.mimeType || 'audio/webm',
      duration: Number(meta.duration) || 0,
      createdAt: meta.createdAt || new Date().toISOString(),
    }
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = () => {
      db.close()
      resolve({ id, mimeType: record.mimeType, duration: record.duration, createdAt: record.createdAt })
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('录音保存失败'))
    }
  })
}

export async function loadAudio(id) {
  if (!id) return null
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => {
      db.close()
      resolve(request.result || null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error || new Error('录音读取失败'))
    }
  })
}

export async function deleteAudio(id) {
  if (!id) return
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('录音删除失败'))
    }
  })
}

export async function clearAllAudio() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('录音清空失败'))
    }
  })
}
