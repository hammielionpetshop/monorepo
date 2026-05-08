export interface Uom {
  id: number
  code: string
  name: string
  isBase: boolean
}

export interface UomFormData {
  code: string
  name: string
  isBase: boolean
}
