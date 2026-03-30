// Fungsi utilitas format mata uang dan tanggal

export function formatRupiah(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return days[date.getDay()];
}

export function formatAmountInput(text: string): string {
  const digits = text.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseAmountInput(text: string): number {
  return parseInt(text.replace(/\D/g, '') || '0', 10);
}

export function getMonthOffset(monthStr: string, offset: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  let newMonth = month + offset;
  let newYear = year;
  while (newMonth <= 0) { newMonth += 12; newYear--; }
  while (newMonth > 12) { newMonth -= 12; newYear++; }
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}
