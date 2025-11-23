import { LinkList, LinkListElement } from "@/constants/LinkList";
import { getCurrentTab } from "@/utils/chrome";
import { sendLinkClick } from "@/utils/analytics";
import React, { use } from "react";

interface LinkGroupProps {
  items?: LinkListElement[];
}

const LinkGroup = ({ items = LinkList }: LinkGroupProps) => {
  return <LinkGroup.Grid items={items} />;
};

const tabPromise = getCurrentTab();

interface GridProps {
  items: LinkListElement[];
}

const Grid = ({ items }: GridProps) => {
  const tab = use(tabPromise);
  const tabHostname = tab?.url ? new URL(tab.url).hostname : "";

  return (
    <div className="Link__Grid grid grid-cols-6 gap-3 p-3 mt-auto border-t">
      {items.map((item, idx) => {
        const isSameHost =
          new URL(item.link).hostname === tabHostname && item.samehost;
        const GridItem = isSameHost
          ? LinkGroup.GridItemSameHost
          : LinkGroup.GridItem;
        const colNum = item.islong ? "col-span-3" : "col-span-2";

        return <GridItem key={idx} item={item} colNum={colNum} />;
      })}
    </div>
  );
};

const GridItem = ({ item, colNum }) => {
  return (
    <button
      className={`${colNum} flex flex-row items-center justify-start px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer`}
      onClick={() => {
        sendLinkClick(item.label, item.link);
        window.open(item.link);
      }}
    >
      <div className="w-9 h-9 rounded-full bg-main/10 flex items-center justify-center shrink-0">
        {item.type === "png" ? (
          <img
            src={item.icon}
            alt={`${item.label} 이미지`}
            className={`Icon__Animation w-5 h-5 ${item.iconColor || 'text-main'}`}
          />
        ) : (
          <item.icon className={`Icon__Animation w-5 h-5 ${item.iconColor || 'text-main'}`} />
        )}
      </div>
      <span className="w-full text-base text-black text-center break-keep">
        {item.label}
      </span>
    </button>
  );
};

const GridItemSameHost = ({ item, colNum }) => {
  return (
    <div
      className={`${colNum} flex flex-row items-center justify-between gap-1.5 rounded-lg hover:bg-gray-100 transition-colors`}
    >
      <button
        className="w-full h-full px-1 bg-main text-white rounded-lg hover:bg-hover transition-colors cursor-pointer text-sm/[normal] break-keep"
        onClick={() => {
          sendLinkClick(`${item.label} - ${item.samehost.content}`, item.link);
          item.samehost.onClick();
        }}
      >
        {item.samehost.content}
      </button>

      {item.samehost2 && (
        <button
          className="w-full h-full px-1 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors cursor-pointer text-sm/[normal] break-keep"
          onClick={() => {
            sendLinkClick(`${item.label} - ${item.samehost2.content}`, item.link);
            item.samehost2.onClick();
          }}
        >
          {item.samehost2.content}
        </button>
      )}
    </div>
  );
};

LinkGroup.Grid = React.memo(Grid);
LinkGroup.GridItem = React.memo(GridItem);
LinkGroup.GridItemSameHost = React.memo(GridItemSameHost);

export default React.memo(LinkGroup);
