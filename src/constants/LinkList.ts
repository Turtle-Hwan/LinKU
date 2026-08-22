import type { MouseEventHandler } from "react";
import {
  BULLETIN_FALLBACK,
  BULLETIN_LINK_ID,
  type BulletinInfo,
} from "@/constants/bulletin";
import {
  LINK_CATALOG,
  type LinkCatalogElement,
} from "@/constants/linkCatalog";
import { executeScript, getCurrentTab, updateTabUrl } from "@/utils/chrome";
import {
  sugangRefreshBtn,
  수강시뮬Btn,
  취득학점확인원Btn,
} from "@/utils/sugang";

export interface SameHost {
  content: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export interface LinkListElement extends LinkCatalogElement {
  samehost?: SameHost;
  samehost2?: SameHost;
}

const runtimeLinkExtras: Partial<
  Record<string, Pick<LinkListElement, "samehost" | "samehost2">>
> = {
  홈페이지: {
    samehost: {
      content: "상용 SW 무료 대여",
      onClick: () => {
        updateTabUrl("https://www.konkuk.ac.kr/kuinc/15905/subview.do");
      },
    },
  },
  위인전: {
    samehost: {
      content: "K-Cube 대여",
      onClick: () => {
        updateTabUrl(
          "https://wein.konkuk.ac.kr/ptfol/cmnt/cube/findCubeResveStep1.do",
        );
      },
    },
  },
  수강신청: {
    samehost: {
      content: "수강인원 새로고침",
      onClick: () => {
        void getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, sugangRefreshBtn);
        });
      },
    },
    samehost2: {
      content: "추가 신청서",
      onClick: () =>
        window.open(
          "https://www.konkuk.ac.kr/konkuk/2088/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa29ua3VrJTJGMjQ3JTJGOTM0OTIyJTJGYXJ0Y2xWaWV3LmRvJTNGcGFnZSUzRDElMjZzcmNoQ29sdW1uJTNEc2olMjZzcmNoV3JkJTNEJUVDJUI0JTg4JUVBJUIzJUJDKyVFQSVCNSU5MCVFQSVCMyVCQyVFQiVBQSVBOSslRUMlQjYlOTQlRUElQjAlODAlMjZiYnNDbFNlcSUzRDEzOTQlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
        ),
    },
  },
  캠퍼스맵: {
    samehost: {
      content: "종강 == 법학관",
    },
  },
  학사정보시스템: {
    samehost: {
      content: "취득학점확인원",
      onClick: () => {
        void getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, 취득학점확인원Btn);
        });
      },
    },
    samehost2: {
      content: "수강시뮬레이션",
      onClick: () => {
        void getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, 수강시뮬Btn);
        });
      },
    },
  },
};

export const LinkList: LinkListElement[] = LINK_CATALOG.map((item) => ({
  ...item,
  ...runtimeLinkExtras[item.label],
}));

export function createDefaultLinkList(
  bulletin: BulletinInfo = BULLETIN_FALLBACK,
): LinkListElement[] {
  return LinkList.map((item) =>
    item.id === BULLETIN_LINK_ID
      ? { ...item, label: bulletin.label, link: bulletin.url }
      : item,
  );
}
