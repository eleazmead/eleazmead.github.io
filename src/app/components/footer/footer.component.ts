import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly buildNumber = environment.buildNumber;
}
