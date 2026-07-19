import { Component } from '@angular/core';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

type QuestionAnswerId = (typeof APP_CONFIG.questionsAndAnswers.items)[number];

@Component({
  selector: 'app-questions-answers',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './questions-answers.component.html',
  styleUrl: './questions-answers.component.scss',
})
export class QuestionsAnswersComponent {
  readonly itemIds = APP_CONFIG.questionsAndAnswers.items;

  textKey(itemId: QuestionAnswerId, field: 'question' | 'answer'): string {
    return `questionsAndAnswers.items.${itemId}.${field}`;
  }
}
