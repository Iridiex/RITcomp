import { LayoutDashboard, Inbox, Package, MapPin, Shuffle, Truck, Navigation, FileText, Send, UserCog, Hospital } from 'lucide-react';

export const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'requests', label: 'Requests', icon: Inbox },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sites', label: 'Sites & staff', icon: MapPin },
    { id: 'allocation', label: 'Allocation', icon: Shuffle },
    { id: 'shipments', label: 'Shipments', icon: Truck },
    { id: 'medical', label: 'Medical', icon: Hospital },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'my-requests', label: 'My requests', icon: Inbox },
    { id: 'incoming', label: 'Incoming deliveries', icon: Truck },
    { id: 'stock', label: 'My stock', icon: Package },
    { id: 'outgoing', label: 'Outgoing shipments', icon: Send },
    { id: 'deliveries', label: 'My deliveries', icon: Navigation },
    { id: 'account', label: 'My account', icon: UserCog },
];
