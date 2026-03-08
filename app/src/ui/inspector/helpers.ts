export function deepSet(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return clone;
}

export function formatKind(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').trim();
}
