import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SheetsService } from './sheets.service';
import { GuestRow } from './models/guest.model';

function makeRow(length: number, overrides: Record<number, string> = {}): string[] {
  const row = Array<string>(length).fill('');
  row[0] = 'HELENA BELEN UMANDAL';
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value;
  return row;
}

describe('SheetsService guest image columns', () => {
  let service: SheetsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SheetsService);
    http = TestBed.inject(HttpTestingController);
  });

  function fetchRows(values: string[][]) {
    let rows: GuestRow[] = [];
    service.fetchGuestList().subscribe((r) => (rows = r));
    http.expectOne(() => true).flush({ values });
    return rows;
  }

  it('reads ImageUrl and ImageCaption from columns T and U, trimmed', () => {
    const rows = fetchRows([
      makeRow(21),
      makeRow(21, { 19: '  https://example.com/mama.jpg ', 20: ' Mama and me, 2020 ' }),
    ]);

    expect(rows[0].imageUrl).toBe('https://example.com/mama.jpg');
    expect(rows[0].imageCaption).toBe('Mama and me, 2020');
  });

  it('falls back to empty strings for rows cached before the columns existed', () => {
    const rows = fetchRows([makeRow(19), makeRow(19)]);

    expect(rows[0].imageUrl).toBe('');
    expect(rows[0].imageCaption).toBe('');
  });
});
