// Converte o caminho da URL em um arquivo dentro do diretório raiz.
// Regra de segurança: NUNCA devolver um arquivo fora da raiz.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type FileLookup =
  | { kind: 'ok'; fullPath: string; size: number }
  | { kind: 'forbidden' } // fora da raiz -> 403
  | { kind: 'notfound' }; // não existe / não é arquivo -> 404

// true se 'candidate' é a própria raiz ou está dentro dela
function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

// root: caminho absoluto e canônico (realpath) da raiz
// urlPath: caminho já decodificado do percent-encoding (ex: "/../etc/passwd")
export async function resolveFile(root: string, urlPath: string): Promise<FileLookup> {
  // 1. '\' também é separador no Windows: "..\..\" sobe diretório lá
  const normalized = urlPath.replace(/\\/g, '/');

  // 2. Junta com a raiz e resolve "." e "..". O '.' na frente impede que
  //    path.resolve trate "/etc/passwd" como caminho absoluto do sistema.
  let fullPath = path.resolve(root, '.' + normalized);
  if (!isInside(root, fullPath)) return { kind: 'forbidden' };

  // 3. Diretório -> serve o index.html dele
  try {
    if ((await fs.stat(fullPath)).isDirectory()) fullPath = path.join(fullPath, 'index.html');
  } catch {
    return { kind: 'notfound' };
  }

  // 4. Segue links simbólicos e confere de novo: um link dentro da raiz
  //    poderia apontar para fora dela
  let realPath: string;
  try {
    realPath = await fs.realpath(fullPath);
  } catch {
    return { kind: 'notfound' };
  }
  if (!isInside(root, realPath)) return { kind: 'forbidden' };

  const stat = await fs.stat(realPath);
  if (!stat.isFile()) return { kind: 'notfound' };
  return { kind: 'ok', fullPath: realPath, size: stat.size };
}
