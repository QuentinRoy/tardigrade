"use client";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { type MouseEvent, type ReactElement, useState } from "react";

export default function ImportMenu(): ReactElement {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = anchorEl != null;

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleOpen}
        endIcon={<ArrowDropDownIcon />}
      >
        Import
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <MenuItem onClick={handleClose} component="a" href="/import/questions">
          Import Questions
        </MenuItem>
        <MenuItem onClick={handleClose} component="a" href="/import/students">
          Import Students
        </MenuItem>
        <MenuItem
          onClick={handleClose}
          component="a"
          href="/import/assessments"
        >
          Import Assessments
        </MenuItem>
      </Menu>
    </>
  );
}
