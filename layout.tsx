import type {Metadata} from 'next';import './globals.css';import Header from '../components/Header';import Footer from '../components/Footer';
export const metadata:Metadata={title:'Grandstand Pass | Sports Tickets',description:'Discover major sporting events worldwide. Grandstand Pass website prototype.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Header/><main>{children}</main><Footer/></body></html>}
