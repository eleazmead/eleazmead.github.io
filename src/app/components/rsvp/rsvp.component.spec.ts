import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isOnOrAfterDate, RsvpComponent } from './rsvp.component';
import { GuestSearchService } from '../../shared/guest-search.service';
import { SheetsService } from '../../shared/sheets.service';
import { TranslationService } from '../../shared/translation.service';
import { GuestRow } from '../../shared/models/guest.model';

describe('RsvpComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsvpComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        {
          provide: GuestSearchService,
          useValue: {
            findByHash: () => of(null),
          },
        },
        {
          provide: SheetsService,
          useValue: {
            submitRsvp: () => of({ status: 'ok' }),
          },
        },
        {
          provide: TranslationService,
          useValue: {
            t: (key: string) => key,
          },
        },
      ],
    }).compileComponents();
  });

  it('clears the main course required error when an attending guest declines', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;

    component.initiatorName.set('HELENA BELEN UMANDAL');
    component.selections.set(
      new Map([['HELENA BELEN UMANDAL', { attending: true, included: true }]]),
    );

    component.onReview();

    expect(component.mealError()).toBe('mainCourse.required');

    component.setAttending('HELENA BELEN UMANDAL', false);

    expect(component.mealError()).toBe('');
  });

  it('prefills an existing RSVP response so the initiator can update it before the deadline', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;

    component.rsvpDeadlineClosed.set(false);
    prepareMatchedGuest(component, {
      ...guestRow,
      rsvpRaw: {
        [guestRow.fullName]: [
          {
            Guest: guestRow.fullName,
            RSVP: true,
            MealChoice: 'fish',
            Date: '2026-07-26T12:00:00+08:00',
          },
        ],
      },
    });

    expect(component.initiatorAlreadyRsvped()).toBe(true);
    expect(component.getSelectionFor(guestRow.fullName)).toEqual({
      attending: true,
      included: true,
    });
    expect(component.getMealChoice(guestRow.fullName)).toBe('fish');
  });

  it('lets the main guest edit related guests they previously RSVP-ed for', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;

    component.rsvpDeadlineClosed.set(false);
    prepareMatchedGuest(component, {
      ...guestRow,
      rsvpRaw: {
        [guestRow.fullName]: [
          {
            Guest: guestRow.fullName,
            RSVP: true,
            MealChoice: 'fish',
            Date: '2026-07-26T12:00:00+08:00',
          },
          {
            Guest: guestRow.guest1Name,
            RSVP: true,
            MealChoice: 'beef',
            Date: '2026-07-26T12:00:00+08:00',
          },
        ],
      },
    });

    expect(component.relatedNames()).toContain(guestRow.guest1Name);
    expect(component.respondedNames().has(guestRow.guest1Name)).toBe(false);
    expect(component.getSelectionFor(guestRow.guest1Name)).toEqual({
      attending: true,
      included: true,
    });
    expect(component.getMealChoice(guestRow.guest1Name)).toBe('beef');
  });

  it('scrolls the success message into view after submitting an RSVP', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;
    const scrollIntoView = vi.fn();
    const querySpy = vi
      .spyOn(document, 'querySelector')
      .mockReturnValue({ scrollIntoView } as unknown as Element);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    component.rsvpDeadlineClosed.set(false);
    component.matchedRow.set(guestRow);
    component.initiatorName.set(guestRow.fullName);
    component.selections.set(new Map([[guestRow.fullName, { attending: false, included: true }]]));

    component.onSubmit();

    expect(component.state()).toBe('success');
    expect(querySpy).toHaveBeenCalledWith('#rsvp .rsvp__success-message');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    rafSpy.mockRestore();
    querySpy.mockRestore();
  });

  it('scrolls the loading spinner into view while submitting an RSVP', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;
    const submitResult = new Subject<{ status: string }>();
    const sheets = TestBed.inject(SheetsService);
    vi.spyOn(sheets, 'submitRsvp').mockReturnValue(submitResult);
    const scrollIntoView = vi.fn();
    const querySpy = vi
      .spyOn(document, 'querySelector')
      .mockReturnValue({ scrollIntoView } as unknown as Element);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    component.rsvpDeadlineClosed.set(false);
    component.matchedRow.set(guestRow);
    component.initiatorName.set(guestRow.fullName);
    component.selections.set(new Map([[guestRow.fullName, { attending: false, included: true }]]));

    component.onSubmit();

    expect(component.state()).toBe('submitting');
    expect(querySpy).toHaveBeenCalledWith('#rsvp .rsvp__spinner');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    submitResult.complete();
    rafSpy.mockRestore();
    querySpy.mockRestore();
  });

  it('blocks review when the RSVP deadline date has arrived', () => {
    const fixture = TestBed.createComponent(RsvpComponent);
    const component = fixture.componentInstance;

    component.rsvpDeadlineClosed.set(true);
    component.selections.set(new Map([[guestRow.fullName, { attending: false, included: true }]]));

    component.onReview();

    expect(component.state()).toBe('idle');
  });

  it('treats the RSVP deadline date as closed at the start of that date in Singapore', () => {
    expect(isOnOrAfterDate(new Date('2026-10-30T15:59:59Z'), '2026-10-31')).toBe(false);
    expect(isOnOrAfterDate(new Date('2026-10-30T16:00:00Z'), '2026-10-31')).toBe(true);
    expect(isOnOrAfterDate(new Date('2026-11-01T00:00:00+08:00'), '2026-10-31')).toBe(true);
  });
});

const guestRow: GuestRow = {
  rowIndex: 2,
  fullName: 'HELENA BELEN UMANDAL',
  guest1Name: 'JUAN DELA CRUZ',
  guest2Name: '',
  rsvpRaw: null,
  rsvpTotal: null,
  rsvpBeefCount: null,
  rsvpFishCount: null,
  rsvpSubmittedAt: null,
  rsvpSubmittedBy: null,
  fullNameHashMd5: 'full-hash',
  guest1FullNameHashMd5: 'guest-1-hash',
  guest2FullNameHashMd5: '',
  letterAddress: '',
  letterMessage: '',
  letterShowForAll: '',
  letterSignedBy: '',
};

function prepareMatchedGuest(component: RsvpComponent, row: GuestRow): void {
  (
    component as unknown as {
      prepareMatchedGuest: (row: GuestRow, matchedName: string) => void;
    }
  ).prepareMatchedGuest(row, row.fullName);
}
