// Log com horário em milissegundos: serve de evidência de atendimento simultâneo.
export function log(tag: string, message: string): void {
  console.log(`${new Date().toISOString()} [${tag}] ${message}`);
}
