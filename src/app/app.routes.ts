import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { AdminComponent } from './components/admin/admin.component';

export const routes: Routes = [
  { path: 'admin', component: AdminComponent },
  { path: '', component: HomeComponent },
  { path: ':rsvpHash', component: HomeComponent },
  { path: '**', redirectTo: '' },
];
