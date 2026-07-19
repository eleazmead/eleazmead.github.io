import { Component } from '@angular/core';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-gift-registry',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './gift-registry.component.html',
  styleUrl: './gift-registry.component.scss',
})
export class GiftRegistryComponent {}
