import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, Info } from 'lucide-react';
import {
  getLibrarySeatRoomsAPI,
  getLibraryTokenFromStorage,
  libraryLoginAPI,
  setLibraryToken,
  openLibraryReservationPage,
} from '@/apis';
import { LibrarySeatRoom } from '@/types/api';
import { loadECampusCredentials } from '@/utils/credentials';

const LibrarySeatSection = () => {
  const [rooms, setRooms] = useState<LibrarySeatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSeatRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // eCampus credentials 로드
      const loadedCredentials = await loadECampusCredentials();

      // 1. 먼저 storage에서 토큰 가져오기 시도
      let token = await getLibraryTokenFromStorage();

      // 2. 토큰이 없으면 eCampus credentials로 로그인 시도
      if (!token && loadedCredentials) {
        const loginResponse = await libraryLoginAPI(
          loadedCredentials.id,
          loadedCredentials.password
        );

        if (loginResponse.success && loginResponse.data) {
          token = loginResponse.data.accessToken;
          // 토큰 저장
          await setLibraryToken(loginResponse.data);
        }
      }

      // 3. 토큰이 없으면 로그인 필요 표시
      if (!token) {
        setNeedLogin(true);
        setError('eCampus 로그인 정보가 필요합니다.');
        return;
      }

      // 4. 좌석 현황 조회
      const response = await getLibrarySeatRoomsAPI(token);

      if (response.success && response.data) {
        setRooms(response.data.list);
        setNeedLogin(false);
        setLastUpdated(new Date());
      } else if (response.needLogin) {
        setNeedLogin(true);
        setError('로그인이 필요합니다.');
      } else {
        setError(response.error || '좌석 현황을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeatRooms();
  }, [fetchSeatRooms]);

  const handleOpenRoom = (roomId: number) => {
    openLibraryReservationPage(roomId);
  };

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getAvailabilityColor = (available: number, total: number): string => {
    const ratio = available / total;
    if (ratio > 0.5) return 'text-green-600';
    if (ratio > 0.2) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">도서관 좌석 현황</h2>

      {needLogin ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              좌석 현황을 보려면 설정 탭에서 eCampus 계정 정보를 등록해주세요.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={fetchSeatRooms}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      ) : error ? (
        <div className="text-center py-4 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="space-y-3">
          {/* 열람실 목록 */}
          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleOpenRoom(room.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{room.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {room.seats.occupied}/{room.seats.total} 사용 중
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg font-bold ${getAvailabilityColor(
                      room.seats.available,
                      room.seats.total
                    )}`}
                  >
                    {room.seats.available}
                  </span>
                  <span className="text-xs text-muted-foreground">잔여</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>

          {/* 하단 컨트롤 */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={fetchSeatRooms} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>

            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                마지막 업데이트: {formatLastUpdated(lastUpdated)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibrarySeatSection;
