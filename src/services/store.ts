import {
  Client,
  Representative,
  Region,
  Manager,
  Preposto,
  Product,
  Project,
  Proposal,
  CalendarEvent,
  AppNotification,
  ImportHistory,
  AuditLog,
  CoverageArea,
  UserProfile,
  ProductPriceHistory,
} from '@/types'
import {
  INITIAL_CLIENTS,
  INITIAL_REPRESENTATIVES,
  INITIAL_REGIONS,
  INITIAL_MANAGERS,
  INITIAL_PREPOSTOS,
  INITIAL_PRODUCTS,
  INITIAL_PROJECTS,
  INITIAL_PROPOSALS,
  INITIAL_NOTIFICATIONS,
  INITIAL_EVENTS,
  INITIAL_IMPORT_HISTORY,
  INITIAL_AUDIT_LOGS,
  INITIAL_COVERAGE_AREAS,
  INITIAL_PRICE_HISTORY,
  INITIAL_USERS,
} from '@/lib/mock-data'

function loadFromStorage<T>(key: string, initialData: T): T {
  try {
    const item = localStorage.getItem(`bener_${key}`)
    return item ? JSON.parse(item) : initialData
  } catch {
    return initialData
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(`bener_${key}`, JSON.stringify(data))
  } catch (e) {
    console.error('Error saving to storage:', e)
  }
}

class Store {
  clients: Client[] = loadFromStorage('clients', INITIAL_CLIENTS)
  representatives: Representative[] = loadFromStorage('representatives', INITIAL_REPRESENTATIVES)
  regions: Region[] = loadFromStorage('regions', INITIAL_REGIONS)
  managers: Manager[] = loadFromStorage('managers', INITIAL_MANAGERS)
  prepostos: Preposto[] = loadFromStorage('prepostos', INITIAL_PREPOSTOS)
  products: Product[] = loadFromStorage('products', INITIAL_PRODUCTS)
  projects: Project[] = loadFromStorage('projects', INITIAL_PROJECTS)
  proposals: Proposal[] = loadFromStorage('proposals', INITIAL_PROPOSALS)
  notifications: AppNotification[] = loadFromStorage('notifications', INITIAL_NOTIFICATIONS)
  events: CalendarEvent[] = loadFromStorage('events', INITIAL_EVENTS)
  importHistory: ImportHistory[] = loadFromStorage('import_history', INITIAL_IMPORT_HISTORY)
  auditLogs: AuditLog[] = loadFromStorage('audit_logs', INITIAL_AUDIT_LOGS)
  coverageAreas: CoverageArea[] = loadFromStorage('coverage_areas', INITIAL_COVERAGE_AREAS)
  priceHistory: ProductPriceHistory[] = loadFromStorage('price_history', INITIAL_PRICE_HISTORY)
  users: UserProfile[] = loadFromStorage('users', INITIAL_USERS)

  // Listeners for reactivity
  private listeners = new Set<() => void>()

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify() {
    this.listeners.forEach((fn) => fn())
  }

  // Audit Helper
  logAction(action: string, details: string, user = 'Carlos Eduardo') {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      acao: action,
      usuario: user,
      timestamp: new Date().toLocaleString('pt-BR'),
      detalhes: details,
    }
    this.auditLogs = [newLog, ...this.auditLogs]
    saveToStorage('audit_logs', this.auditLogs)
    this.notify()
  }

  // CRUD Generic Handlers
  saveItem<T extends { id: string }>(
    key: string,
    listKey: keyof Store,
    item: Partial<T> & { id?: string },
  ): T {
    const currentList = [...(this[listKey] as unknown as T[])]
    let resultItem: T

    if (item.id) {
      const idx = currentList.findIndex((i) => i.id === item.id)
      if (idx !== -1) {
        currentList[idx] = { ...currentList[idx], ...item }
        resultItem = currentList[idx]
      } else {
        resultItem = { ...item, id: item.id } as T
        currentList.unshift(resultItem)
      }
    } else {
      resultItem = { ...item, id: `${key.slice(0, 4)}-${Date.now()}` } as T
      currentList.unshift(resultItem)
    }

    ;(this[listKey] as unknown as T[]) = currentList
    saveToStorage(key, currentList)
    this.notify()
    return resultItem
  }

  deleteItem<T extends { id: string }>(key: string, listKey: keyof Store, id: string) {
    const currentList = (this[listKey] as unknown as T[]).filter((i) => i.id !== id)
    ;(this[listKey] as unknown as T[]) = currentList
    saveToStorage(key, currentList)
    this.notify()
  }
}

export const benerStore = new Store()
