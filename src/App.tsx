import { FiBarChart2, FiCalendar, FiClipboard, FiCreditCard, FiGrid, FiInbox, FiPackage, FiPercent, FiSettings, FiStar, FiTruck, FiUser, FiUsers, FiNavigation, FiFileText, FiMessageSquare } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useApi } from './lib/api';
import { useAuth } from './features/auth/auth';
import { Loading } from './components/feedback';
import { Shell, type NavItem } from './components/Shell';
import Addons from './features/addons/Addons';
import { BookingAlerts, NEW_BOOKINGS_EVENT } from './features/notifications/BookingAlerts';
import { go, useRoute } from './lib/nav';
import BookingDetail from './features/bookings/BookingDetail';
import Bookings from './features/bookings/Bookings';
import CalendarPage from './features/calendar/CalendarPage';
import Customers from './features/customers/Customers';
import Drivers from './features/drivers/Drivers';
import Events from './features/events/Events';
import Enquiries, { ENQUIRIES_CHANGED } from './features/enquiries/Enquiries';
import Login from './features/auth/Login';
import Offers from './features/offers/Offers';
import Overview from './features/overview/Overview';
import Payments from './features/payments/Payments';
import Reports from './features/reports/Reports';
import Settings from './features/settings/Settings';
import Airports from './features/airports/Airports';
import Terms from './features/terms/Terms';
import Chatbot from './features/chatbot/Chatbot';
import VehicleEditor from './features/vehicles/VehicleEditor';
import Vehicles from './features/vehicles/Vehicles';

const titles: Record<string, [string, string]> = {
  overview: ['Overview', 'How the business is doing'],
  bookings: ['Bookings', 'Journey requests, upcoming journeys and history'],
  enquiries: ['Enquiries', 'Leads, messages and quote requests from the website and the chat assistant'],
  chatbot: ['Chat assistant', 'The website AI assistant: results, conversations and settings'],
  vehicles: ['Fleet', 'Vehicles, photos and availability'],
  calendar: ['Calendar', 'Who has which vehicle, and when'],
  events: ['Services', 'The chauffeur services customers can book'],
  addons: ['Extras', 'Optional extras customers can add to a journey'],
  airports: ['Airports', 'Airports customers can choose, and their website pages'],
  terms: ['Terms & Conditions', 'The terms customers accept when they book'],
  drivers: ['Chauffeurs', 'Your chauffeurs, licences and assignments'],
  payments: ['Payments', 'Money in, refunds and reconciliation'],
  offers: ['Offers', 'Discounts and coupon codes'],
  customers: ['Customers', 'People who have booked or enquired'],
  reports: ['Reports', 'Figures for any period'],
  settings: ['Settings', 'Business details, booking rules, payments and email'],
};

export default function App() {
  const { staff, ready } = useAuth();
  if (!ready) return <div style={{ padding: 60 }}><Loading label="Starting" /></div>;
  if (!staff) return <Login />;
  return <Portal />;
}

function Portal() {
  const { staff, signOut } = useAuth();
  const [page = 'overview', id] = useRoute();
  // Bumped when a new booking arrives so the sidebar counts refresh straight away.
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    const on = () => setFresh((n) => n + 1);
    window.addEventListener(NEW_BOOKINGS_EVENT, on);
    window.addEventListener(ENQUIRIES_CHANGED, on);
    return () => { window.removeEventListener(NEW_BOOKINGS_EVENT, on); window.removeEventListener(ENQUIRIES_CHANGED, on); };
  }, []);
  // `r` only varies the URL so the count refreshes whenever you move between pages.
  const { data: pending } = useApi<{ total: number }>(`/bookings?status=pending&limit=1&r=${page}/${id ?? ''}/${fresh}`);
  // Customers' extension requests need a decision too.
  const { data: extRequests } = useApi<{ items: unknown[] }>(`/extension-requests?r=${page}/${id ?? ''}/${fresh}`);
  // Website enquiries still to answer.
  const { data: enq } = useApi<{ total: number }>(`/enquiries?open=true&limit=1&r=${page}/${id ?? ''}/${fresh}`);
  const { data: cfg } = useApi<{ settings: Record<string, unknown> }>('/settings');
  const nav: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: FiGrid },
    { key: 'bookings', label: 'Bookings', icon: FiClipboard, count: (pending?.total ?? 0) + (extRequests?.items.length ?? 0) },
    { key: 'enquiries', label: 'Enquiries', icon: FiInbox, count: enq?.total ?? 0 },
    { key: 'vehicles', label: 'Fleet', icon: FiTruck },
    { key: 'calendar', label: 'Calendar', icon: FiCalendar },
    { key: 'events', label: 'Services', icon: FiStar },
    { key: 'addons', label: 'Extras', icon: FiPackage },
    { key: 'airports', label: 'Airports', icon: FiNavigation },
    { key: 'drivers', label: 'Chauffeurs', icon: FiUser },
    { key: 'payments', label: 'Payments', icon: FiCreditCard },
    { key: 'offers', label: 'Offers', icon: FiPercent },
    { key: 'customers', label: 'Customers', icon: FiUsers },
    { key: 'reports', label: 'Reports', icon: FiBarChart2 },
    { key: 'terms', label: 'Terms & Conditions', icon: FiFileText },
    ...(['owner', 'administrator'].includes(staff!.role) ? [{ key: 'chatbot', label: 'Chat assistant', icon: FiMessageSquare }] : []),
    { key: 'settings', label: 'Settings', icon: FiSettings },
  ];
  const [title, sub] = page === 'vehicles' && id === 'new' ? ['Add a vehicle', 'A few short steps, then publish'] : page === 'vehicles' && id ? ['Vehicle', 'Edit details, photos, services, pricing and availability'] : page === 'bookings' && id ? ['Booking', 'Journey, payments, chauffeur and history'] : titles[page] ?? titles.overview;

  return (
    <Shell logoUrl={(cfg?.settings['branding.logoUrl'] as string) || null} portal="Company admin" nav={nav} active={nav.some((n) => n.key === page) ? page : 'overview'} onNavigate={(k) => go(k)} title={title} sub={sub}
      user={{ name: staff!.name, role: staff!.role === 'owner' ? 'Company owner' : staff!.role.replaceAll('_', ' ') }} onSignOut={signOut} actions={<BookingAlerts />}>
      {page === 'overview' ? <Overview /> : null}
      {page === 'bookings' ? (id ? <BookingDetail key={id} id={id} /> : <Bookings />) : null}
      {page === 'vehicles' ? (id ? <VehicleEditor key={id} id={id} /> : <Vehicles />) : null}
      {page === 'enquiries' ? <Enquiries openId={id} /> : null}
      {page === 'calendar' ? <CalendarPage /> : null}
      {page === 'events' ? <Events /> : null}
      {page === 'addons' ? <Addons /> : null}
      {page === 'airports' ? <Airports /> : null}
      {page === 'terms' ? <Terms /> : null}
      {page === 'chatbot' ? <Chatbot /> : null}
      {page === 'drivers' ? <Drivers /> : null}
      {page === 'payments' ? <Payments /> : null}
      {page === 'offers' ? <Offers /> : null}
      {page === 'customers' ? <Customers openId={id} /> : null}
      {page === 'reports' ? <Reports /> : null}
      {page === 'settings' ? <Settings /> : null}
      {!titles[page] ? <Overview /> : null}
    </Shell>
  );
}
