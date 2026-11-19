import { Image, token } from "nsh";
import alert from "./icons/alert.svg";
import apps from "./icons/apps.svg";
import arrow from "./icons/arrow.svg";
import bat from "./icons/bat.svg";
import box from "./icons/box.svg";
import check from "./icons/check.svg";
import refresh from "./icons/refresh.svg";
import search from "./icons/search.svg";
import terminal from "./icons/terminal.svg";
import trash from "./icons/trash.svg";
import update from "./icons/update.svg";

const icons = {alert, apps, arrow, bat, box, check, refresh, search, terminal, trash, update};
const sizes = {xs: "w-3 h-3", sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5"};

export type IconName = keyof typeof icons;
export type IconTone = "foreground" | "soft" | "subtle" | "primary" | "primary-foreground" | "danger" | "success";

/** One stroke family, tinted by a theme token. Decorative: the control around it carries the name. */
export function Icon(p: {name: IconName; tone?: IconTone; size?: keyof typeof sizes}) {
  return <Image src={icons[p.name]} accessibilityElementsHidden
    class={sizes[p.size || "md"]} style={{tintColor: token(p.tone || "subtle")}}/>;
}
