import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import TrackingTimeline from '../components/TrackingTimeline';
import MyMap from '../components/MyMap';
import CopyButton from '../components/CopyButton';
import { SkeletonBlock, SkeletonMap } from '../components/SkeletonLoading';
import { apiGetOrderTracking, apiRateOrder, createTrackingWebSocket, resolvePhotoUrl } from '../services/api';
import { sanitizeShipment } from '../utils/shipmentUtils';
import { 
  Search, 
  MapPin, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Wifi,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  X,
  Eye,
  Star,
  User,
  FileText,
  Phone,
  MessageSquare,
  Sparkles,
  ThumbsUp
} from 'lucide-react';
import ParcelDetailModal from '../components/ParcelDetailModal';
import InvoiceModal from '../components/InvoiceModal';
import { getConsignmentPhoto } from '../utils/parcelUtils';

export default function TrackingPage() {
  const { 
    shipments, 
    selectedAwb, 
    setSelectedAwb, 
    trackingQuery, 
    isBackendOnline,
    theme,
    addToast,
    openChatbox,
    updateShipmentStatus,
    updateShipmentRecord,
    refreshBackendOrders,
    isLoadingOrders,
    currentUser,
    currentRole
  } = useApp();

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlAwb = urlParams?.get('awb') || '';
  const urlAction = urlParams?.get('action') || '';

  const initialAwb = (urlAwb || trackingQuery || selectedAwb || '').trim();
  const [inputVal, setInputVal] = useState(initialAwb);
  const [activeShipment, setActiveShipment] = useState(() => {
    const raw = shipments.find(s => s.awbNumber.toLowerCase() === initialAwb.toLowerCase()) || shipments[0];
    return sanitizeShipment(raw);
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState(null);
  const [viewingParcel, setViewingParcel] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Customer Star Rating & Review State (Exclusively for Customers)
  const [selectedStars, setSelectedStars] = useState(5);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [selectedReviewTags, setSelectedReviewTags] = useState([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Service Skeleton Shimmer Loading - strictly 1.0s as requested
  const [isTrackingLoading, setIsTrackingLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTrackingLoading(false);
    }, 1000); // 1.0s service skeleton loading
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (urlAwb && (!activeShipment || activeShipment.awbNumber.toLowerCase() !== urlAwb.toLowerCase())) {
      performSearch(urlAwb);
    }
    if (urlAction === 'rate') {
      setTimeout(() => {
        const el = document.getElementById('customer-rating-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1200);
    }
  }, [urlAwb, urlAction]);

  const lastLoadedAwbRef = useRef(initialAwb.toUpperCase());

  const performSearch = useCallback(async (targetQuery, shouldToast = false) => {
    const query = (targetQuery || '').trim();
    if (!query) {
      if (shouldToast) addToast('Please enter an Air Waybill (AWB) number.', 'warning');
      return;
    }

    setIsSearching(true);
    setIsTrackingLoading(true);
    setSearchError('');
    lastLoadedAwbRef.current = query.toUpperCase();

    const minDelay = new Promise(resolve => setTimeout(resolve, 1000)); // strictly 1.0s service loading

    try {
      if (isBackendOnline) {
        const res = await apiGetOrderTracking(query);
        if (res && res.data) {
          await minDelay;
          setActiveShipment(sanitizeShipment(res.data));
          setSelectedAwb(res.data.awbNumber);
          if (shouldToast) {
            addToast(`Found shipment ${res.data.awbNumber}!`, 'success');
          }
          setIsSearching(false);
          setIsTrackingLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Backend lookup notice:", e.message);
    }

    await minDelay;
    // Local state fallback (matches by AWB number, Order ID, or Display ID)
    const qLower = query.toLowerCase();
    const found = shipments.find(s => 
      (s.awbNumber && s.awbNumber.toLowerCase() === qLower) ||
      (s.orderId && s.orderId.toLowerCase() === qLower) ||
      (s.displayOrderId && s.displayOrderId.toLowerCase() === qLower) ||
      (s.id && s.id.toLowerCase() === qLower)
    );
    if (found) {
      setActiveShipment(sanitizeShipment(found));
      setSelectedAwb(found.awbNumber);
      if (shouldToast) {
        addToast(`Found shipment: ${found.awbNumber}`, 'success');
      }
    } else {
      setSearchError(`Shipment "${query}" not found. Please verify the AWB number.`);
      if (shouldToast) {
        addToast(`AWB "${query}" not found. Please check the consignment number and try again.`, 'warning');
      }
    }
    setIsSearching(false);
    setIsTrackingLoading(false);
  }, [isBackendOnline, shipments, setSelectedAwb, addToast]);

  // Sync when trackingQuery or selectedAwb changes externally
  useEffect(() => {
    const target = (trackingQuery || selectedAwb || '').trim();
    if (target && target.toUpperCase() !== lastLoadedAwbRef.current) {
      setInputVal(target);
      performSearch(target, false);
    }
  }, [trackingQuery, selectedAwb, performSearch]);

  // Reactive Sync: Automatically keep activeShipment updated when shipments in AppContext update (e.g. Captain delivers package)
  useEffect(() => {
    if (!activeShipment?.awbNumber) return;
    const currentAwbLower = activeShipment.awbNumber.toLowerCase();
    const match = shipments.find(s => 
      (s.awbNumber && s.awbNumber.toLowerCase() === currentAwbLower) ||
      (s.orderId && s.orderId.toLowerCase() === currentAwbLower)
    );
    if (match) {
      const sanitized = sanitizeShipment(match);
      if (
        sanitized.currentStatus !== activeShipment.currentStatus ||
        sanitized.status !== activeShipment.status ||
        JSON.stringify(sanitized.proofOfDelivery) !== JSON.stringify(activeShipment.proofOfDelivery) ||
        (sanitized.events?.length || 0) !== (activeShipment.events?.length || 0)
      ) {
        setActiveShipment(sanitized);
      }
    }
  }, [shipments, activeShipment?.awbNumber, activeShipment?.currentStatus, activeShipment?.status, activeShipment?.proofOfDelivery, activeShipment?.events?.length]);

  // Cross-tab storage synchronization: Instant update if captain delivered in another browser tab
  useEffect(() => {
    const handleStorageChange = (e) => {
      if ((e.key === 'aerodispatch_shipments' || e.key === 'aerodispatch_order_updated') && e.newValue) {
        try {
          const updatedList = e.key === 'aerodispatch_shipments' ? JSON.parse(e.newValue) : null;
          if (Array.isArray(updatedList) && activeShipment?.awbNumber) {
            const currentAwbLower = activeShipment.awbNumber.toLowerCase();
            const match = updatedList.find(s => 
              (s.awbNumber && s.awbNumber.toLowerCase() === currentAwbLower) ||
              (s.orderId && s.orderId.toLowerCase() === currentAwbLower)
            );
            if (match) {
              setActiveShipment(sanitizeShipment(match));
            }
          }
        } catch (err) {
          console.warn("Storage sync error:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeShipment?.awbNumber]);

  // Connect live WebSocket stream for active shipment
  useEffect(() => {
    const targetAwb = activeShipment?.awbNumber;
    if (!targetAwb || !isBackendOnline) {
      setWsConnected(prev => (prev ? false : prev));
      return;
    }

    let ws = null;
    try {
      ws = createTrackingWebSocket(
        targetAwb,
        (msg) => {
          if (msg.type === 'TRACKING_UPDATE' && msg.data) {
            setActiveShipment(sanitizeShipment(msg.data));
            addToast(`Update: Shipment ${msg.awbNumber} is now ${msg.status}!`, 'info');
          }
        },
        () => setWsConnected(false)
      );
      if (ws) setWsConnected(true);
    } catch {
      setWsConnected(false);
    }

    return () => {
      if (ws) {
        ws.close();
      }
      setWsConnected(false);
    };
  }, [activeShipment?.awbNumber, isBackendOnline, addToast]);

  const handleCopyAwb = () => {
    if (!activeShipment?.awbNumber) return;
    navigator.clipboard.writeText(activeShipment.awbNumber);
    setCopiedAwb(true);
    addToast(`Copied AWB ${activeShipment.awbNumber} to clipboard`, 'info');
    setTimeout(() => setCopiedAwb(false), 2000);
  };

  const handleToggleReviewTag = (tag) => {
    setSelectedReviewTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleRatingSubmit = async (e) => {
    e?.preventDefault();
    if (!activeShipment?.awbNumber) return;

    // Strict Role Separation: Drivers and Admins CANNOT rate their own or assigned deliveries
    const isDriverViewer = (currentRole === 'driver' || (currentUser?.role === 'driver' && currentRole !== 'customer')) && currentRole !== 'customer';
    const isAdminViewer = currentRole === 'admin' || (currentUser?.role === 'admin' && currentRole !== 'customer');

    if (isDriverViewer) {
      addToast('Couriers & Drivers cannot rate their own deliveries. Ratings are submitted exclusively by customers.', 'warning');
      return;
    }
    if (isAdminViewer) {
      addToast('Administrators cannot submit ratings on behalf of customers.', 'warning');
      return;
    }

    setIsSubmittingRating(true);
    try {
      const fullFeedback = [
        selectedReviewTags.length > 0 ? `[${selectedReviewTags.join(', ')}]` : '',
        ratingFeedback.trim()
      ].filter(Boolean).join(' ');

      const res = await apiRateOrder(activeShipment.awbNumber, selectedStars, fullFeedback);
      addToast(`Thank you! Your ${selectedStars}★ rating for Captain ${activeShipment.assignedDriver?.name || 'Rishabh Verma'} has been recorded.`, 'success');
      const updatedShipment = res?.data || {
        ...activeShipment,
        customerRating: {
          rating: selectedStars,
          feedback: fullFeedback,
          ratedBy: currentUser?.name || activeShipment.recipient?.name || 'Customer',
          ratedAt: new Date().toISOString()
        }
      };
      setActiveShipment(updatedShipment);
      if (updateShipmentRecord) updateShipmentRecord(updatedShipment);
    } catch (err) {
      addToast(err.message || 'Failed to submit rating', 'error');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      addToast('Please enter an Air Waybill (AWB) number.', 'warning');
      return;
    }
    performSearch(inputVal.trim(), true);
  };

  const getStageIndex = (status) => {
    switch (status) {
      case 'BOOKED': return 0;
      case 'PICKED_UP': return 1;
      case 'HUB_INBOUND': return 2;
      case 'IN_TRANSIT': return 3;
      case 'OUT_FOR_DELIVERY': return 4;
      case 'DELIVERED': return 5;
      case 'FAILED_ATTEMPT': return 4;
      case 'CANCELLED': return 0;
      default: return 1;
    }
  };

  const currentStageIndex = getStageIndex(activeShipment?.currentStatus);
  const stages = [
    { label: 'Booked', icon: Package },
    { label: 'Picked Up', icon: Clock },
    { label: 'Hub Inbound', icon: MapPin },
    { label: 'Linehaul Transit', icon: Truck },
    { label: 'Out for Delivery', icon: CheckCircle2 },
    { label: 'Delivered', icon: CheckCircle2 }
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '1rem auto 4rem' }}>
      {/* Search Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Track Shipment
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
          Track delivery milestones, shipment status, and proof of delivery.
        </p>

        {/* Search Bar Input */}
        <form onSubmit={handleSearch} style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
            />
            <input 
              type="text"
              className="form-input mono google-search-input search-input-with-icon"
              style={{ paddingLeft: '3.25rem', paddingRight: '1.4rem', fontSize: '1rem', letterSpacing: '0.05em', borderRadius: '9999px', boxShadow: 'var(--google-search-shadow)' }}
              placeholder="Enter AWB (e.g. AD-8849-2041, AD-2910-4491)..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              aria-label="Track Air Waybill Number"
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
            disabled={isSearching}
          >
            {isSearching ? <RefreshCw size={18} className="pulse" /> : <Search size={18} />}
            <span>{isSearching ? 'Querying...' : 'Track'}</span>
          </button>

          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={refreshBackendOrders}
            disabled={isLoadingOrders}
            style={{ padding: '0.75rem 1.4rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title="Refresh database records (1.5s live sync)"
          >
            <RefreshCw size={17} className={isLoadingOrders ? 'spin' : ''} />
            <span>{isLoadingOrders ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </form>
      </div>

      {(isSearching || isTrackingLoading || isLoadingOrders) ? (
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '40%' }}>
              <SkeletonBlock width="65%" height="28px" />
              <SkeletonBlock width="45%" height="14px" />
            </div>
            <SkeletonBlock width="130px" height="32px" borderRadius="9999px" />
          </div>
          <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0' }}>
            <SkeletonBlock width="20%" height="16px" />
            <SkeletonBlock width="20%" height="16px" />
            <SkeletonBlock width="20%" height="16px" />
            <SkeletonBlock width="20%" height="16px" />
          </div>
          <SkeletonMap />
        </div>
      ) : searchError && !activeShipment ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--accent-amber)' }}>
          <AlertTriangle size={36} color="var(--accent-amber)" style={{ margin: '0 auto 1rem' }} />
          <h3>Shipment Not Found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{searchError}</p>
        </div>
      ) : activeShipment ? (
        <>
          {/* Main Hero Status Card */}
          <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {/* Clickable Consignment Parcel Thumbnail */}
                <div
                  onClick={() => setViewingParcel(activeShipment)}
                  title="Click to view full consignment dossier & specs"
                  className="clickable-parcel-thumbnail"
                  style={{ width: '74px', height: '74px', flexShrink: 0, borderRadius: '18px' }}
                >
                  <img 
                    src={getConsignmentPhoto(activeShipment)} 
                    alt="Consignment Parcel" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div className="parcel-zoom-hint">
                    <Eye size={20} color="#ffffff" />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {activeShipment.awbNumber}
                    </h2>
                    <CopyButton text={activeShipment.awbNumber} />
                    <StatusBadge status={activeShipment.currentStatus} />
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-muted)'
                    }}>
                      {activeShipment.serviceTier}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>Current Location: <strong>{activeShipment.currentLocation}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.45rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Estimated Delivery SLA</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.2rem' }}>
                    {new Date(activeShipment.estimatedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsInvoiceModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', padding: '0.35rem 0.85rem', borderRadius: '9999px' }}
                  title="View and download official GST tax invoice"
                >
                  <FileText size={13} />
                  <span>Tax Invoice / Receipt</span>
                </button>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ padding: '1rem 0 1.5rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', minWidth: '560px' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '16px', 
                  left: '20px', 
                  right: '20px', 
                  height: '3px', 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  zIndex: 1 
                }}>
                  <div style={{ 
                    width: `${(currentStageIndex / (stages.length - 1)) * 100}%`, 
                    height: '100%', 
                    background: activeShipment.currentStatus === 'FAILED_ATTEMPT' ? 'var(--accent-rose)' : 'var(--primary)', 
                    transition: 'width 0.4s ease' 
                  }}></div>
                </div>

                {stages.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex || (idx === currentStageIndex && activeShipment.currentStatus === 'DELIVERED');
                  const isCurrent = idx === currentStageIndex;
                  const isFailed = isCurrent && activeShipment.currentStatus === 'FAILED_ATTEMPT';
                  const Icon = stage.icon;

                  let nodeBg = 'var(--bg-elevated)';
                  let nodeBorder = 'rgba(255, 255, 255, 0.2)';
                  let nodeColor = 'var(--text-dim)';

                  if (isFailed) {
                    nodeBg = 'var(--accent-rose)';
                    nodeBorder = 'var(--accent-rose)';
                    nodeColor = '#FFFFFF';
                  } else if (isCompleted) {
                    nodeBg = 'var(--accent-emerald)';
                    nodeBorder = 'var(--accent-emerald)';
                    nodeColor = '#070B14';
                  } else if (isCurrent) {
                    nodeBg = 'var(--primary)';
                    nodeBorder = 'var(--primary)';
                    nodeColor = '#070B14';
                  }

                  return (
                    <div key={idx} style={{ position: 'relative', zIndex: 2, textAlign: 'center', width: '85px' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: nodeBg, 
                        border: `2px solid ${nodeBorder}`,
                        color: nodeColor,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem',
                        boxShadow: isCurrent ? (isFailed ? '0 0 15px rgba(244, 63, 94, 0.5)' : '0 0 15px var(--primary-glow)') : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                        <Icon size={16} />
                      </div>
                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: isCurrent ? 800 : 500, 
                        color: isFailed ? 'var(--accent-rose)' : isCompleted || isCurrent ? 'var(--text-main)' : 'var(--text-dim)',
                        display: 'block'
                      }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Vector Route Map Section */}
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Route Map
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Active Segment: <strong>{activeShipment.sender?.city || 'Origin'}</strong> ➔ <strong>{activeShipment.recipient?.city || 'Destination'}</strong>
                </span>
              </div>

              {/* Vector Map */}
              <MyMap shipment={activeShipment} />
            </div>

            {/* Live Customer Consignment Status Card (When in progress) */}
            {!activeShipment.proofOfDelivery && activeShipment.currentStatus !== 'DELIVERED' && (
              <div style={{ 
                marginTop: '1.25rem', 
                padding: '1.15rem 1.35rem', 
                background: activeShipment.currentStatus === 'OUT_FOR_DELIVERY' 
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)' 
                  : 'var(--bg-secondary)', 
                border: activeShipment.currentStatus === 'OUT_FOR_DELIVERY'
                  ? '1px solid rgba(99, 102, 241, 0.35)'
                  : '1px solid var(--border-medium)', 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: activeShipment.currentStatus === 'OUT_FOR_DELIVERY'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : activeShipment.currentStatus === 'IN_TRANSIT'
                      ? 'rgba(14, 165, 233, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: activeShipment.currentStatus === 'OUT_FOR_DELIVERY'
                      ? '#6366F1'
                      : activeShipment.currentStatus === 'IN_TRANSIT'
                      ? '#0EA5E9'
                      : '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {activeShipment.currentStatus === 'OUT_FOR_DELIVERY' ? (
                      <Truck size={22} />
                    ) : activeShipment.currentStatus === 'IN_TRANSIT' ? (
                      <Clock size={22} />
                    ) : (
                      <Package size={22} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>
                        {activeShipment.currentStatus === 'OUT_FOR_DELIVERY'
                          ? 'Out for Doorstep Delivery'
                          : activeShipment.currentStatus === 'IN_TRANSIT'
                          ? 'In Transit Across Logistics Network'
                          : 'Order Booked & Registered'}
                      </span>
                      <StatusBadge status={activeShipment.currentStatus} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {activeShipment.currentStatus === 'OUT_FOR_DELIVERY' ? (
                        <>Assigned to Captain <strong>{activeShipment.assignedDriver?.name || 'Rishabh Verma'}</strong>. Arrival expected shortly at your doorstep.</>
                      ) : activeShipment.currentStatus === 'IN_TRANSIT' ? (
                        <>Package is moving across regional logistics hubs towards <strong>{activeShipment.recipient?.city || 'Destination'}</strong>.</>
                      ) : (
                        <>Shipment registered in express logistics pipeline. Awaiting courier allocation and air dispatch.</>
                      )}
                    </div>
                  </div>
                </div>

                {activeShipment.currentStatus === 'OUT_FOR_DELIVERY' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a
                      href={`tel:${activeShipment.assignedDriver?.phone || '+919876543210'}`}
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                    >
                      <Phone size={14} />
                      <span>Call Captain</span>
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => openChatbox ? openChatbox(activeShipment.awbNumber) : null}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                    >
                      <MessageSquare size={14} />
                      <span>Chat with Captain</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Captain review unlocks once delivery handover is completed.
                  </div>
                )}
              </div>
            )}

            {/* Proof of Delivery Card if completed */}
            {activeShipment.proofOfDelivery && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1.25rem', 
                background: 'rgba(16, 185, 129, 0.08)', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '50%', 
                    background: 'rgba(16, 185, 129, 0.2)', 
                    color: 'var(--accent-emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      Delivery Handover Complete
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Accepted by <strong>{activeShipment.proofOfDelivery.deliveredTo}</strong> at {activeShipment.proofOfDelivery.timestamp} • <em>{activeShipment.proofOfDelivery.verificationMethod}</em>
                    </div>
                  </div>
                </div>

                {activeShipment.proofOfDelivery.photoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setEnlargedPhotoUrl(resolvePhotoUrl(activeShipment.proofOfDelivery.photoUrl))}
                      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                      title="Enlarge proof photo"
                    >
                      <img 
                        src={resolvePhotoUrl(activeShipment.proofOfDelivery.photoUrl)} 
                        alt="Handover photo preview" 
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&q=80';
                        }}
                      />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEnlargedPhotoUrl(resolvePhotoUrl(activeShipment.proofOfDelivery.photoUrl))}
                      style={{ fontSize: '0.75rem' }}
                    >
                      <span>Inspect Photo</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Customer Rating Card for Delivered Consignments */}
            {(activeShipment.currentStatus === 'DELIVERED' || activeShipment.status === 'delivered') && (() => {
              const isDriverViewer = (currentRole === 'driver' || (currentUser?.role === 'driver' && currentRole !== 'customer')) && currentRole !== 'customer';
              const isAdminViewer = currentRole === 'admin' || (currentUser?.role === 'admin' && currentRole !== 'customer');
              const canSubmitRating = !isDriverViewer && !isAdminViewer;
              const captainName = activeShipment.assignedDriver?.name || 'Rishabh Verma';
              const captainInitials = captainName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CP';

              const REVIEW_PRESETS = [
                '⚡ Super Fast Delivery',
                '📦 Handled with Care',
                '🛡️ Safe & Contactless',
                '⭐ Polite & Courteous Captain',
                '📍 Perfect Doorstep Drop'
              ];

              const STAR_TEXTS = {
                1: '1 Star - Needs Improvement',
                2: '2 Stars - Fair Service',
                3: '3 Stars - Good Delivery',
                4: '4 Stars - Very Good Experience',
                5: '5 Stars - Outstanding Delivery & Service!'
              };

              return (
                <div 
                  id="customer-rating-section"
                  style={{ 
                    marginTop: '1.25rem', 
                    padding: '1.35rem 1.6rem', 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  {/* Card Header with Captain Info */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
                        flexShrink: 0
                      }}>
                        {captainInitials}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)' }}>
                          <Star size={18} fill="#F59E0B" color="#F59E0B" />
                          <span>
                            {isDriverViewer
                              ? 'Customer Rating & Service Review'
                              : isAdminViewer
                              ? 'Consignment Customer Review & Performance'
                              : `Rate Delivery Captain ${captainName}`}
                          </span>
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {isDriverViewer ? (
                            <>Delivery completed to recipient <strong>{activeShipment.recipient?.name || 'Customer'}</strong> ({activeShipment.recipient?.city || 'Destination'})</>
                          ) : (
                            <>Doorstep handover fulfilled by Captain <strong>{captainName}</strong> • Verified Courier</>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeShipment.customerRating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245, 158, 11, 0.12)', padding: '0.4rem 0.95rem', borderRadius: '9999px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                        <Star size={16} fill="#F59E0B" color="#F59E0B" />
                        <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '0.9rem' }}>
                          {activeShipment.customerRating.rating} / 5 Stars
                        </span>
                      </div>
                    )}
                  </div>

                  {activeShipment.customerRating ? (
                    /* Existing Verified Review */
                    <div style={{ background: 'var(--bg-primary)', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              size={18} 
                              fill={star <= activeShipment.customerRating.rating ? '#F59E0B' : 'none'} 
                              color={star <= activeShipment.customerRating.rating ? '#F59E0B' : 'var(--text-dim)'} 
                            />
                          ))}
                          <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '0.88rem', marginLeft: '0.4rem' }}>
                            {activeShipment.customerRating.rating} / 5 Rating
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={14} />
                          <span>Verified Customer Review</span>
                        </span>
                      </div>
                      {activeShipment.customerRating.feedback && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: '0.4rem 0 0 0', fontStyle: 'italic', lineHeight: 1.45 }}>
                          "{activeShipment.customerRating.feedback}"
                        </p>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.55rem' }}>
                        Submitted by <strong>{activeShipment.customerRating.ratedBy || 'Customer'}</strong> • Added to Captain {captainName}'s service history
                      </div>
                    </div>
                  ) : canSubmitRating ? (
                    /* Interactive Customer Review Form */
                    <form onSubmit={handleRatingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Star Rating Picker */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Your Star Rating:</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {[1, 2, 3, 4, 5].map((star) => {
                              const isFilled = (hoveredStars || selectedStars) >= star;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setSelectedStars(star)}
                                  onMouseEnter={() => setHoveredStars(star)}
                                  onMouseLeave={() => setHoveredStars(0)}
                                  style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '0.2rem',
                                    transform: (hoveredStars === star || selectedStars === star) ? 'scale(1.15)' : 'scale(1)',
                                    transition: 'transform 0.15s ease' 
                                  }}
                                  title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
                                >
                                  <Star 
                                    size={26} 
                                    fill={isFilled ? '#F59E0B' : 'transparent'} 
                                    color={isFilled ? '#F59E0B' : 'var(--text-dim)'} 
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F59E0B', marginLeft: '0.25rem' }}>
                            {STAR_TEXTS[hoveredStars || selectedStars] || `${selectedStars} Stars`}
                          </span>
                        </div>
                      </div>

                      {/* Quick-Select Compliment Tags */}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.4rem', fontWeight: 600 }}>
                          Select Quick Compliments (Click to tag):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                          {REVIEW_PRESETS.map((tag) => {
                            const isSelected = selectedReviewTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleToggleReviewTag(tag)}
                                style={{
                                  background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
                                  border: isSelected ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-medium)',
                                  color: isSelected ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.78rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {tag} {isSelected ? '✓' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Feedback Comment Box */}
                      <div>
                        <textarea
                          className="form-input"
                          rows={2}
                          placeholder={`Write a quick review for Captain ${captainName} (e.g. On-time delivery, polite attitude, verified package handover)...`}
                          value={ratingFeedback}
                          onChange={(e) => setRatingFeedback(e.target.value)}
                          style={{ fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                        />
                      </div>

                      {/* Submit Button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                          Feedback directly updates Captain {captainName}'s rating score
                        </span>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isSubmittingRating}
                          style={{ 
                            padding: '0.55rem 1.6rem', 
                            borderRadius: '9999px', 
                            fontSize: '0.85rem', 
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                            border: 'none',
                            color: '#ffffff',
                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                          }}
                        >
                          <Star size={15} fill="#ffffff" />
                          <span>{isSubmittingRating ? 'Submitting Review...' : `Submit Review for Captain ${captainName}`}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Read-Only Notice for Drivers & Admins */
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.85rem 1.15rem',
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px dashed rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F59E0B',
                        flexShrink: 0
                      }}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Awaiting Customer Rating &amp; Review
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {isDriverViewer
                            ? `Ratings are submitted exclusively by recipient ${activeShipment.recipient?.name || 'Customer'}. Couriers and drivers cannot rate their own deliveries. When the recipient leaves a rating, it will appear here and reflect on your Captain leaderboard score.`
                            : `Pending recipient evaluation. Only the verified customer (${activeShipment.recipient?.name || 'Customer'}) can submit this rating.`
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Details & Event Log Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Left: Origin, Destination & Package Specs */}
            <div>
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={18} color="var(--primary)" />
                  <span>Logistics Route &amp; Locations</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {/* Sender */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Sender (Origin)</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{activeShipment.sender?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{activeShipment.sender?.city}, {activeShipment.sender?.pinCode}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>{activeShipment.sender?.address}</div>
                  </div>

                  {/* Recipient */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Recipient (Destination)</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{activeShipment.recipient?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{activeShipment.recipient?.city}, {activeShipment.recipient?.pinCode}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>{activeShipment.recipient?.address}</div>
                  </div>
                </div>

                {/* Context-Aware Contact Card (Captain contacting Customer vs Customer contacting Captain) */}
                {(() => {
                  const isCaptainUser = 
                    (currentRole === 'driver' || (currentUser?.role === 'driver' && currentRole !== 'customer')) && 
                    currentRole !== 'customer';

                  const customerName = activeShipment.recipient?.name || activeShipment.sender?.name || 'Customer';
                  const customerPhone = activeShipment.recipient?.phone || activeShipment.sender?.phone || '';
                  const customerCity = activeShipment.recipient?.city || activeShipment.sender?.city || '';

                  // 1. If currently viewed from Captain account: Contact the Customer
                  if (isCaptainUser) {
                    return (
                      <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(0, 240, 255, 0.08)', borderRadius: '16px', border: '1px solid rgba(0, 240, 255, 0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00F0FF' }}>
                              <User size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#00F0FF', fontWeight: 800 }}>
                                Customer &amp; Consignee Contact
                              </div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {customerName}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Destination: <strong>{customerCity || 'Delivery Address'}</strong> {customerPhone ? `• Phone: ${customerPhone}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {customerPhone && (
                              <a
                                href={`tel:${customerPhone}`}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '0.4rem 0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', borderRadius: '9999px' }}
                              >
                                <span>📞 Call Customer</span>
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => openChatbox({
                                recipientName: customerName,
                                recipientRole: 'customer',
                                recipientPhone: customerPhone,
                                awbNumber: activeShipment.awbNumber,
                                role: 'driver'
                              })}
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '9999px' }}
                            >
                              <span>💬 Chat with Customer</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 2. If viewed by Customer or Admin: Contact Assigned Delivery Captain
                  if (activeShipment.assignedDriver) {
                    const drv = activeShipment.assignedDriver;
                    const captainName = drv.name?.replace(/^captain\s+/i, '').replace(/pandey/i, '').trim() || 'Rishabh';
                    const captainPhone = (drv.phone && !drv.phone.includes('9004') && !drv.phone.includes('8469')) ? drv.phone : '+91 98451 90214';
                    const captainVehicle = (drv.vehicleNumber && !drv.vehicleNumber.includes('8469') && !drv.vehicleNumber.includes('3051')) ? drv.vehicleNumber : 'MH-02-EV-0214';

                    return (
                      <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                              <Truck size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#10B981', fontWeight: 800 }}>
                                Assigned Delivery Captain
                              </div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                Captain {captainName}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {captainPhone ? `Phone: ${captainPhone} • ` : ''}Vehicle: {captainVehicle}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {captainPhone && (
                              <a
                                href={`tel:${captainPhone}`}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '0.4rem 0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', borderRadius: '9999px' }}
                              >
                                <span>📞 Call Captain</span>
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => openChatbox({
                                recipientName: `Captain ${captainName}`,
                                recipientRole: 'driver',
                                recipientPhone: captainPhone,
                                awbNumber: activeShipment.awbNumber,
                                role: 'customer'
                              })}
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '9999px' }}
                            >
                              <span>💬 Chat with Captain</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Package Specs */}
              <div className="card">
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={18} color="var(--primary)" />
                  <span>Package Specifications</span>
                </h3>

                <div className="table-container">
                  <table className="logistics-table">
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--text-dim)', width: '40%' }}>Declared Dead Weight</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{activeShipment.weightKg} kg</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-dim)' }}>Volumetric Dimensions</td>
                        <td className="mono">{activeShipment.dimensions || '25 x 18 x 10 cm'}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-dim)' }}>Declared Value &amp; Mode</td>
                        <td className="mono">₹{activeShipment.declaredValue?.toLocaleString()} ({activeShipment.paymentMode})</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-dim)' }}>Package Category</td>
                        <td>{activeShipment.category}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Real-Time Event Audit Timeline */}
            <div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={18} color="var(--primary)" />
                    <span>Shipment Progress History</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {activeShipment.events?.length || 0} Milestones Logged
                  </span>
                </div>

                <TrackingTimeline events={activeShipment.events || []} currentStatus={activeShipment.currentStatus} />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Enlarged Proof Photo Modal */}
      {enlargedPhotoUrl && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
          <div className="modal-dialog" style={{ maxWidth: '520px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 id="photo-modal-title" style={{ fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="var(--accent-emerald)" />
                <span>Proof of Delivery Dossier</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setEnlargedPhotoUrl(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <img 
              src={enlargedPhotoUrl} 
              alt="Full size proof of delivery" 
              style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', marginBottom: '1rem' }} 
            />

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Photographic proof recorded at doorstep handover for Air Waybill <strong>{activeShipment?.awbNumber}</strong>.
            </div>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => setEnlargedPhotoUrl(null)}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Google Material 3 Consignment Dossier Pop-up Modal */}
      {viewingParcel && (
        <ParcelDetailModal 
          parcel={viewingParcel} 
          onClose={() => setViewingParcel(null)} 
        />
      )}

      {/* Official Tax Invoice & Waybill Receipt Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        order={activeShipment}
      />
    </div>
  );
}
